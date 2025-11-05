# Dashboard Queue Peeking - Design Fix

## Problem Statement

The dashboard's queue monitoring feature is causing excessive SQS receive count inflation:

### Root Cause Analysis

1. **SQS Behavior with `visibility_timeout=0`**:
   - When calling `receive_message` with `max_number_of_messages=10` and `visibility_timeout=0`
   - If only 1 message exists in the queue, SQS returns **the same message 10 times** in one response
   - Each return increments the `ApproximateReceiveCount` by 1
   - Result: **10 receive count increments per API call**

2. **Dashboard Auto-Refresh**:
   - Queue detail page auto-refreshes every 15 seconds
   - Queue list page auto-refreshes every 30 seconds
   - Each refresh triggers `receive_message` calls

3. **Observed Impact**:
   - 18 API requests in 6 minutes
   - 18 requests × 10 receives = **180 receive count**
   - Message receive count grew to 181 in just 2 minutes

4. **Previous Amplifying Factors** (now fixed):
   - React StrictMode causing double renders (now disabled)
   - RefetchOnWindowFocus, RefetchOnMount causing extra calls (now disabled)

## Requirements

1. **Non-Invasive Monitoring**: Dashboard must not affect queue behavior or message lifecycle
2. **Multi-Message Support**: Show up to 50 messages for pagination/browsing
3. **Performance**: Minimize SQS API calls and costs
4. **Accurate Metadata**: Don't artificially inflate receive counts
5. **No Consumer Impact**: Messages should remain available to real consumers

## Proposed Solution

### Strategy: Batch Receive with Proper Visibility Timeout

#### Configuration
```rust
// API Constants
pub const SQS_VISIBILITY_TIMEOUT_PEEK: i32 = 300; // 5 minutes
pub const SQS_MAX_MESSAGES_PER_BATCH: i32 = 10; // SQS hard limit
pub const DASHBOARD_MESSAGE_LIMIT: i32 = 50; // Total messages to fetch
pub const DASHBOARD_BATCH_COUNT: i32 = 5; // 5 batches × 10 = 50 messages
```

#### Implementation Approach

**1. Sequential Batch Fetching**
```rust
// Pseudo-code
let mut all_messages = Vec::new();
let mut seen_message_ids = HashSet::new();

for batch in 0..DASHBOARD_BATCH_COUNT {
    let result = sqs_client
        .receive_message()
        .max_number_of_messages(SQS_MAX_MESSAGES_PER_BATCH)
        .visibility_timeout(SQS_VISIBILITY_TIMEOUT_PEEK) // 5 minutes
        .send()
        .await?;

    for message in result.messages() {
        // Deduplicate (shouldn't be needed, but defensive)
        if !seen_message_ids.contains(&message.message_id) {
            seen_message_ids.insert(message.message_id.clone());
            all_messages.push(message);
        }
    }

    // Stop if we got fewer messages than requested (queue is exhausted)
    if result.messages().len() < SQS_MAX_MESSAGES_PER_BATCH {
        break;
    }
}

return all_messages; // Up to 50 unique messages
```

**2. Trade-offs and Behavior**
- Messages become invisible for **5 minutes** after dashboard views them
- Prevents rapid re-receiving during auto-refresh window
- External consumers need to wait up to 5 minutes if dashboard just viewed the message
- For app queues with no active consumers: **No impact**
- For outbound queue with Lambda consumers: **Minor delay acceptable** (Lambda has retry logic)

**3. Auto-Refresh Behavior**
- **Default**: Auto-refresh OFF
- When ON: Refresh every 30 seconds
- With 5-minute visibility timeout: Messages stay invisible during multiple refreshes
- After 5 minutes: Messages become visible again, will be re-fetched if still in queue

**4. Receive Count Impact**
- Initial fetch: +1 receive count per message
- Refreshes within 5 minutes: +0 (messages still invisible)
- After 5 minutes: +1 if message re-appears (wasn't consumed)
- **Vastly better than current: +10 per fetch**

### Alternative Considered: Longer Visibility Timeout

Using 3600s (1 hour) visibility timeout:
- **Pro**: Even less receive count inflation
- **Con**: Messages invisible to consumers for 1 hour - too disruptive
- **Decision**: 300s (5 minutes) is a better balance

## Implementation Plan

### Phase 1: Update API Constants
**File**: `crates/mailflow-api/src/constants.rs`
- Change `SQS_VISIBILITY_TIMEOUT_PEEK` from `0` to `300`
- Add `DASHBOARD_MESSAGE_LIMIT = 50`
- Add `DASHBOARD_BATCH_COUNT = 5`

### Phase 2: Update API Queue Endpoint
**File**: `crates/mailflow-api/src/api/queues.rs`
- Implement sequential batch fetching logic
- Fetch up to 5 batches of 10 messages each
- Deduplicate by message ID
- Return up to 50 messages total

### Phase 3: Update Dashboard (Already Done)
**File**: `dashboard/src/pages/queues/index.tsx`
- ✅ Auto-refresh disabled by default
- ✅ RefetchOnWindowFocus/Mount/Reconnect disabled
- ✅ React StrictMode disabled

### Phase 4: Update Infrastructure (Already Done)
**File**: `infra/src/queues.ts`
- ✅ Removed redrive policy from app queues
- ✅ Set visibility timeout to 300s

### Phase 5: Rebuild and Deploy
1. Rebuild API Lambda with new constants
2. Deploy to AWS
3. Test with fresh messages
4. Monitor receive counts

## Expected Outcome

### Before Fix
- Receive count: **+10 per API call** (same message returned 10 times)
- 18 calls in 6 min = **180 receives**
- Messages moved to DLQ after 5 API calls (50 receives / 5 = DLQ)

### After Fix
- Receive count: **+1 per message per 5-minute window**
- 18 calls in 6 min, but only **1 receive** per message (stays invisible)
- Messages **never move to DLQ** (no redrive policy)
- Can fetch up to 50 different messages per request

## Metrics

- **Cost reduction**: 10× fewer SQS receives
- **Accuracy**: Receive count reflects actual unique receives
- **Visibility**: Show up to 50 messages instead of 1 deduplicated message
- **Consumer impact**: 5-minute delay acceptable for queues with no active consumers

## Risk Assessment

**Low Risk**:
- App queues have no active Lambda consumers
- 5-minute invisibility window is acceptable
- No data loss - messages return after timeout
- Redrive policy removed, so no DLQ movement

**Mitigation**:
- Document this behavior in dashboard UI (tooltip)
- Allow users to turn off auto-refresh (already implemented)
- Consider adding "Release Messages" button to make them visible immediately (future enhancement)
