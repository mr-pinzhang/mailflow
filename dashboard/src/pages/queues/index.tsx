import { useState, useRef } from 'react';
import { useCustom } from '@refinedev/core';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { apiClient } from '../../utils/api';
import {
  Card,
  Table,
  Tag,
  Badge,
  Input,
  Button,
  Space,
  Select,
  Typography,
  Row,
  Col,
  Statistic,
  Descriptions,
  Modal,
  message,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  InboxOutlined,
  SendOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  DeleteOutlined,
  DownOutlined,
  UpOutlined,
  QuestionCircleOutlined,
  MailOutlined,
  FileTextOutlined,
  DownloadOutlined,
  SyncOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

// TypeScript interfaces
interface Queue {
  name: string;
  type: 'inbound' | 'outbound' | 'dlq';
  messageCount: number;
  messagesInFlight: number;
  oldestMessageAge: number;
  url?: string;
  createdAt?: string;
}

interface QueueMessage {
  messageId: string;
  receiptHandle: string;
  body: string;
  preview: string;
  attributes: {
    SentTimestamp?: string;
    ApproximateReceiveCount?: string;
    ApproximateFirstReceiveTimestamp?: string;
  };
  messageAttributes?: Record<string, any>;
  md5OfBody?: string;
}

interface QueuesResponse {
  queues: Queue[];
  total: number;
}

interface QueueMessagesResponse {
  messages: QueueMessage[];
  queueInfo: Queue;
  totalCount: number;
}

// Queue type configuration
const queueTypeConfig = {
  inbound: {
    color: 'blue',
    icon: <InboxOutlined />,
    label: 'Inbound',
  },
  outbound: {
    color: 'green',
    icon: <SendOutlined />,
    label: 'Outbound',
  },
  dlq: {
    color: 'red',
    icon: <WarningOutlined />,
    label: 'Dead Letter',
  },
};

// Helper function to format age
const formatAge = (seconds: number): string => {
  if (seconds === 0) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};

// QueuesPage Component (List View)
export const QueuesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false); // Disabled by default to prevent receive count inflation
  const navigate = useNavigate();

  const { query } = useCustom<QueuesResponse>({
    url: '/queues',
    method: 'get',
    queryOptions: {
      refetchInterval: autoRefresh ? 30000 : false, // 30 seconds
      refetchOnWindowFocus: false, // Prevent refetch when switching tabs
      refetchOnMount: false, // Prevent refetch on component remount
      refetchOnReconnect: false, // Prevent refetch on network reconnect
    },
  });

  const { data, isLoading, refetch } = query;

  const queues = data?.data?.queues || [];

  // Filter queues based on search and type
  const filteredQueues = queues.filter((queue) => {
    const matchesSearch = queue.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || queue.type === filterType;
    return matchesSearch && matchesType;
  });

  // Calculate statistics
  const stats = {
    total: queues.length,
    totalMessages: queues.reduce((sum, q) => sum + q.messageCount, 0),
    inFlight: queues.reduce((sum, q) => sum + q.messagesInFlight, 0),
    dlqCount: queues.filter((q) => q.type === 'dlq').length,
  };

  const columns: ColumnsType<Queue> = [
    {
      title: 'Queue Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, record: Queue) => (
        <Space>
          <Text strong>{name}</Text>
          {record.type === 'dlq' && (
            <Badge status="error" text="DLQ" />
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      filters: [
        { text: 'Inbound', value: 'inbound' },
        { text: 'Outbound', value: 'outbound' },
        { text: 'Dead Letter', value: 'dlq' },
      ],
      onFilter: (value, record) => record.type === value,
      render: (type: Queue['type']) => {
        const config = queueTypeConfig[type];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Messages',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 120,
      sorter: (a, b) => a.messageCount - b.messageCount,
      render: (count: number) => (
        <Badge
          count={count}
          showZero
          overflowCount={9999}
          style={{ backgroundColor: count > 0 ? '#1890ff' : '#d9d9d9' }}
        />
      ),
    },
    {
      title: 'In Flight',
      dataIndex: 'messagesInFlight',
      key: 'messagesInFlight',
      width: 120,
      sorter: (a, b) => a.messagesInFlight - b.messagesInFlight,
      render: (count: number) => (
        <Badge
          count={count}
          showZero
          overflowCount={9999}
          style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }}
        />
      ),
    },
    {
      title: 'Oldest Message',
      dataIndex: 'oldestMessageAge',
      key: 'oldestMessageAge',
      width: 140,
      sorter: (a, b) => (a.oldestMessageAge || 0) - (b.oldestMessageAge || 0),
      render: (age: number | null) => (
        <Space>
          <ClockCircleOutlined />
          <Text type={(age || 0) > 3600 ? 'danger' : undefined}>
            {age ? formatAge(age) : 'N/A'}
          </Text>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '600',
          margin: 0,
          marginBottom: '8px',
          color: '#262626'
        }}>
          <InboxOutlined style={{ marginRight: '12px' }} />
          Queue Management
        </h1>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          Monitor and manage SQS queues for email processing
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Total Queues"
              value={stats.total}
              prefix={<InboxOutlined style={{ fontSize: '20px' }} />}
              valueStyle={{ fontSize: '28px', fontWeight: '600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Total Messages"
              value={stats.totalMessages}
              prefix={<MessageOutlined style={{ fontSize: '20px' }} />}
              valueStyle={{ color: '#1890ff', fontSize: '28px', fontWeight: '600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="In Flight"
              value={stats.inFlight}
              prefix={<SendOutlined style={{ fontSize: '20px' }} />}
              valueStyle={{ color: '#52c41a', fontSize: '28px', fontWeight: '600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Dead Letter Queues"
              value={stats.dlqCount}
              prefix={<WarningOutlined style={{ fontSize: '20px' }} />}
              valueStyle={{
                color: stats.dlqCount > 0 ? '#ff4d4f' : '#52c41a',
                fontSize: '28px',
                fontWeight: '600'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters and Actions */}
      <Card style={{ marginBottom: '16px', borderRadius: '8px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={10}>
            <Search
              placeholder="Search queues by name..."
              allowClear
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="large"
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={6}>
            <Select
              placeholder="Filter by type"
              value={filterType}
              onChange={setFilterType}
              style={{ width: '100%' }}
              size="large"
              options={[
                { label: 'All Types', value: 'all' },
                { label: 'Inbound', value: 'inbound' },
                { label: 'Outbound', value: 'outbound' },
                { label: 'Dead Letter', value: 'dlq' },
              ]}
            />
          </Col>
          <Col xs={24} sm={24} md={10} lg={8} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Space>
              <Tooltip title={autoRefresh ? 'Auto-refreshing every 30s' : 'Auto-refresh paused'}>
                <Button
                  icon={autoRefresh ? <SyncOutlined spin /> : <PauseCircleOutlined />}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  type={autoRefresh ? 'primary' : 'default'}
                  size="large"
                >
                  {autoRefresh ? 'Auto' : 'Manual'}
                </Button>
              </Tooltip>
              <Button
                icon={<ReloadOutlined spin={isLoading} />}
                onClick={() => refetch()}
                loading={isLoading}
                size="large"
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Queues Table */}
      <Card style={{ borderRadius: '8px' }}>
        <Table
          dataSource={filteredQueues}
          columns={columns}
          rowKey="name"
          loading={isLoading}
          scroll={{ x: 800 }} // Enable horizontal scroll on mobile
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} queues`,
            responsive: true,
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/queues/${record.name}`),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: searchTerm || filterType !== 'all'
              ? 'No queues match your filters'
              : 'No queues available',
          }}
        />
      </Card>
    </div>
  );
};

// QueueDetailPage Component (Detail View)
export const QueueDetailPage = () => {
  const { name } = useParams<{ name: string }>();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [isPurging, setIsPurging] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchRedriving, setIsBatchRedriving] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false); // Disabled by default to prevent receive count inflation
  const refreshInterval = 15; // seconds - fixed interval
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const searchInputRef = useRef<any>(null);

  const { query } = useCustom<QueueMessagesResponse>({
    url: `/queues/${name}/messages`,
    method: 'get',
    queryOptions: {
      enabled: !!name && name !== ':name',
      refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
      refetchOnWindowFocus: false, // Prevent refetch when switching tabs
      refetchOnMount: false, // Prevent refetch on component remount
      refetchOnReconnect: false, // Prevent refetch on network reconnect
    },
  });

  const { data, isLoading, refetch } = query;

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'r',
      description: 'Refresh messages',
      action: () => refetch(),
    },
    {
      key: '/',
      description: 'Focus search',
      action: () => searchInputRef.current?.focus(),
    },
    {
      key: 'Escape',
      description: 'Clear selection',
      action: () => setSelectedRowKeys([]),
    },
    {
      key: '?',
      shiftKey: true,
      description: 'Show keyboard shortcuts',
      action: () => setShowShortcutsHelp(true),
    },
    {
      key: 'a',
      description: 'Toggle auto-refresh',
      action: () => setAutoRefresh(!autoRefresh),
    },
  ], true);

  const rawMessages = data?.data?.messages || [];
  const totalCount = data?.data?.totalCount || 0;
  const queueInfo = data?.data?.queueInfo;

  // Deduplicate messages by messageId (SQS can return duplicates with visibility_timeout=0)
  const messages = rawMessages.filter((msg: QueueMessage, index: number, self: QueueMessage[]) =>
    index === self.findIndex((m: QueueMessage) => m.messageId === msg.messageId)
  );

  // Helper function to calculate message age
  const getMessageAge = (sentTimestamp: string | undefined): number => {
    if (!sentTimestamp) return 0;
    const sentTime = parseInt(sentTimestamp);
    const now = Date.now();
    return Math.floor((now - sentTime) / 1000); // Age in seconds
  };

  // Helper function to format age with color
  const formatAgeWithColor = (ageInSeconds: number): { text: string; color: string } => {
    if (ageInSeconds === 0) return { text: 'N/A', color: 'default' };

    const hours = Math.floor(ageInSeconds / 3600);
    const days = Math.floor(ageInSeconds / 86400);

    let text: string;
    let color: string;

    if (days > 7) {
      text = `${days}d`;
      color = '#ff4d4f'; // Red - very old
    } else if (days > 1) {
      text = `${days}d ${hours % 24}h`;
      color = '#faad14'; // Orange - old
    } else if (hours > 1) {
      text = `${hours}h`;
      color = '#1890ff'; // Blue - moderate
    } else {
      const minutes = Math.floor(ageInSeconds / 60);
      text = `${minutes}m`;
      color = '#52c41a'; // Green - fresh
    }

    return { text, color };
  };

  // Filter messages based on search text
  const filteredMessages = messages.filter((msg: QueueMessage) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      msg.messageId.toLowerCase().includes(searchLower) ||
      msg.body.toLowerCase().includes(searchLower) ||
      msg.preview.toLowerCase().includes(searchLower)
    );
  });

  // Check if this is a DLQ and determine main queue name
  const isDLQ = name?.toLowerCase().includes('-dlq') || name?.toLowerCase().includes('dlq-');
  const mainQueueName = isDLQ && name
    ? name.replace(/-dlq$/i, '').replace(/-DLQ$/i, '').replace(/^dlq-/i, '').replace(/^DLQ-/i, '')
    : null;

  const handleRedriveMessage = async (messageId: string, receiptHandle: string, body: string) => {
    if (!mainQueueName) {
      message.error('Cannot determine main queue name for re-drive');
      return;
    }

    Modal.confirm({
      title: 'Re-drive Message',
      content: (
        <div>
          <p>Move this message back to the main queue?</p>
          <p><strong>From:</strong> {name}</p>
          <p><strong>To:</strong> {mainQueueName}</p>
          <p><strong>Message ID:</strong> {messageId.substring(0, 20)}...</p>
        </div>
      ),
      okText: 'Move to Main Queue',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await apiClient.post(`/queues/${name}/messages/redrive`, {
            receiptHandle,
            body,
            targetQueueName: mainQueueName,
          });
          message.success(`Message moved to ${mainQueueName} successfully`);
          // Remove message from UI
          setExpandedRowKeys(expandedRowKeys.filter(k => k !== messageId));
          refetch();
        } catch (error) {
          message.error('Failed to re-drive message. Please try again.');
          throw error;
        }
      },
    });
  };

  const handleDeleteMessage = async (messageId: string, receiptHandle: string) => {
    Modal.confirm({
      title: 'Delete Message',
      content: (
        <div>
          <p>Are you sure you want to delete this message?</p>
          <p><strong>Message ID:</strong> {messageId.substring(0, 20)}...</p>
          <p style={{ color: '#ff4d4f' }}>
            Warning: This action cannot be undone.
          </p>
        </div>
      ),
      okText: 'Delete Message',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await apiClient.post(`/queues/${name}/messages/delete`, { receiptHandle });
          message.success('Message deleted successfully');
          // Remove message from UI
          setExpandedRowKeys(expandedRowKeys.filter(k => k !== messageId));
          refetch();
        } catch (error) {
          message.error('Failed to delete message. Please try again.');
          throw error;
        }
      },
    });
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select messages to delete');
      return;
    }

    Modal.confirm({
      title: `Delete ${selectedRowKeys.length} Messages`,
      content: (
        <div>
          <p>Are you sure you want to delete {selectedRowKeys.length} selected message{selectedRowKeys.length > 1 ? 's' : ''}?</p>
          <p style={{ color: '#ff4d4f' }}>
            Warning: This action cannot be undone.
          </p>
        </div>
      ),
      okText: 'Delete All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setIsBatchDeleting(true);
        let successCount = 0;
        let failCount = 0;

        for (const messageId of selectedRowKeys) {
          const msg = messages.find((m: QueueMessage) => m.messageId === messageId);
          if (!msg) continue;

          try {
            await apiClient.post(`/queues/${name}/messages/delete`, {
              receiptHandle: msg.receiptHandle,
            });
            successCount++;
          } catch (error) {
            failCount++;
          }
        }

        setIsBatchDeleting(false);
        setSelectedRowKeys([]);

        if (successCount > 0) {
          message.success(`Successfully deleted ${successCount} message${successCount > 1 ? 's' : ''}`);
        }
        if (failCount > 0) {
          message.error(`Failed to delete ${failCount} message${failCount > 1 ? 's' : ''}`);
        }

        refetch();
      },
    });
  };

  const handleExportMessages = () => {
    const dataToExport = selectedRowKeys.length > 0
      ? messages.filter((m: QueueMessage) => selectedRowKeys.includes(m.messageId))
      : messages;

    if (dataToExport.length === 0) {
      message.warning('No messages to export');
      return;
    }

    const exportData = dataToExport.map((msg: QueueMessage) => ({
      messageId: msg.messageId,
      sentTime: msg.attributes.SentTimestamp ? new Date(parseInt(msg.attributes.SentTimestamp)).toISOString() : null,
      receiveCount: msg.attributes.ApproximateReceiveCount,
      firstReceiveTime: msg.attributes.ApproximateFirstReceiveTimestamp
        ? new Date(parseInt(msg.attributes.ApproximateFirstReceiveTimestamp)).toISOString()
        : null,
      preview: msg.preview,
      body: msg.body,
      attributes: msg.attributes,
      messageAttributes: msg.messageAttributes,
    }));

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `queue-${name}-messages-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success(`Exported ${dataToExport.length} message${dataToExport.length > 1 ? 's' : ''}`);
  };

  const handleBatchRedrive = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select messages to re-drive');
      return;
    }

    if (!mainQueueName) {
      message.error('Cannot determine main queue name for re-drive');
      return;
    }

    Modal.confirm({
      title: `Re-drive ${selectedRowKeys.length} Messages`,
      content: (
        <div>
          <p>Move {selectedRowKeys.length} selected message{selectedRowKeys.length > 1 ? 's' : ''} back to the main queue?</p>
          <p><strong>From:</strong> {name}</p>
          <p><strong>To:</strong> {mainQueueName}</p>
        </div>
      ),
      okText: 'Move All to Main Queue',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        setIsBatchRedriving(true);
        let successCount = 0;
        let failCount = 0;

        for (const messageId of selectedRowKeys) {
          const msg = messages.find((m: QueueMessage) => m.messageId === messageId);
          if (!msg) continue;

          try {
            await apiClient.post(`/queues/${name}/messages/redrive`, {
              receiptHandle: msg.receiptHandle,
              body: msg.body,
              targetQueueName: mainQueueName,
            });
            successCount++;
          } catch (error) {
            failCount++;
          }
        }

        setIsBatchRedriving(false);
        setSelectedRowKeys([]);

        if (successCount > 0) {
          message.success(`Successfully moved ${successCount} message${successCount > 1 ? 's' : ''} to ${mainQueueName}`);
        }
        if (failCount > 0) {
          message.error(`Failed to move ${failCount} message${failCount > 1 ? 's' : ''}`);
        }

        refetch();
      },
    });
  };

  const handlePurgeQueue = () => {
    setPurgeConfirmText('');
    setShowPurgeModal(true);
  };

  const handlePurgeConfirm = async () => {
    if (purgeConfirmText !== name) {
      message.error('Queue name does not match. Please type the exact queue name.');
      return;
    }

    setIsPurging(true);
    setShowPurgeModal(false);

    try {
      await apiClient.post(`/queues/${name}/purge`);
      message.success(`Queue "${name}" has been purged successfully`);
      setPurgeConfirmText('');
      refetch();
    } catch (error) {
      message.error('Failed to purge queue. Please try again.');
    } finally {
      setIsPurging(false);
    }
  };

  // Parse message body safely
  const parseMessageBody = (body: string): any => {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  };

  // Format JSON with syntax highlighting
  const formatJson = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };

  // Format timestamp
  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString();
  };

  const columns: ColumnsType<QueueMessage> = [
    {
      title: '',
      key: 'expand',
      width: 48,
      align: 'center',
      render: (_, record) => {
        const isExpanded = expandedRowKeys.includes(record.messageId);
        return (
          <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
            <Button
              type="link"
              size="small"
              icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                if (isExpanded) {
                  setExpandedRowKeys(expandedRowKeys.filter(k => k !== record.messageId));
                } else {
                  setExpandedRowKeys([...expandedRowKeys, record.messageId]);
                }
              }}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Message ID',
      dataIndex: 'messageId',
      key: 'messageId',
      width: 250,
      ellipsis: true,
      render: (id: string) => (
        <Text code copyable={{ text: id }}>
          {id.substring(0, 20)}...
        </Text>
      ),
    },
    {
      title: 'Sent Time',
      key: 'sentTime',
      width: 180,
      sorter: (a, b) => {
        const timeA = parseInt(a.attributes.SentTimestamp || '0');
        const timeB = parseInt(b.attributes.SentTimestamp || '0');
        return timeA - timeB;
      },
      defaultSortOrder: 'descend' as const,
      render: (_, record) => {
        const age = getMessageAge(record.attributes.SentTimestamp);
        const ageDisplay = formatAgeWithColor(age);
        return (
          <div>
            <Text>{formatTimestamp(record.attributes.SentTimestamp)}</Text>
            <br />
            <Text style={{ color: ageDisplay.color, fontSize: '12px' }}>
              {ageDisplay.text} ago
            </Text>
          </div>
        );
      },
    },
    {
      title: (
        <Space>
          <span>Receive Count</span>
          <Tooltip title="Number of times this message has been received but not deleted. High counts (>3) may indicate processing failures or visibility timeout issues.">
            <QuestionCircleOutlined style={{ cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      key: 'receiveCount',
      width: 150,
      align: 'center',
      sorter: (a, b) => {
        const countA = parseInt(a.attributes.ApproximateReceiveCount || '0');
        const countB = parseInt(b.attributes.ApproximateReceiveCount || '0');
        return countA - countB;
      },
      render: (_, record) => {
        const count = parseInt(
          record.attributes.ApproximateReceiveCount || '0'
        );
        const getColor = () => {
          if (count > 5) return '#ff4d4f'; // Red - critical
          if (count > 3) return '#faad14'; // Orange/Yellow - warning
          if (count > 1) return '#1890ff'; // Blue - info
          return '#52c41a'; // Green - good
        };
        const getTooltipText = () => {
          if (count > 5) return 'Critical: Message may be poison or processing is failing repeatedly';
          if (count > 3) return 'Warning: Message has been received multiple times without being deleted';
          if (count > 1) return 'Info: Message has been retried';
          return 'Good: Message is being processed normally';
        };
        return (
          <Tooltip title={getTooltipText()}>
            <Badge
              count={count}
              showZero
              style={{ backgroundColor: getColor() }}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Preview',
      key: 'preview',
      ellipsis: true,
      render: (_, record) => {
        // Extract a more concise preview
        const isEmail = record.preview.startsWith('Email from:');
        const icon = isEmail ? <MailOutlined /> : <FileTextOutlined />;

        // If it's an email format, extract just the subject
        let displayText = record.preview;
        if (isEmail) {
          const subjectMatch = record.preview.match(/Subject: (.+)/);
          if (subjectMatch) {
            displayText = subjectMatch[1];
          }
        } else {
          // For non-email, show first 50 chars
          displayText = record.preview.length > 50
            ? record.preview.substring(0, 50) + '...'
            : record.preview;
        }

        return (
          <Space>
            {icon}
            <Text type="secondary" ellipsis>{displayText}</Text>
          </Space>
        );
      },
    },
  ];

  const expandedRowRender = (record: QueueMessage) => {
    const body = parseMessageBody(record.body);
    const isJson = typeof body === 'object';

    return (
      <div className="bg-gray-50 p-4 rounded">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', gap: '8px' }}>
          {isDLQ && mainQueueName && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleRedriveMessage(record.messageId, record.receiptHandle, record.body)}
            >
              Move to Main Queue
            </Button>
          )}
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteMessage(record.messageId, record.receiptHandle)}
          >
            Delete Message
          </Button>
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Message Details */}
          <Descriptions title="Message Details" bordered size="small" column={2}>
            <Descriptions.Item label="Message ID" span={2}>
              <Text code copyable>
                {record.messageId}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Receipt Handle" span={2}>
              <Text code copyable ellipsis>
                {record.receiptHandle}
              </Text>
            </Descriptions.Item>
            {record.md5OfBody && (
              <Descriptions.Item label="MD5 of Body" span={2}>
                <Text code>{record.md5OfBody}</Text>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Sent Timestamp">
              {formatTimestamp(record.attributes.SentTimestamp)}
            </Descriptions.Item>
            <Descriptions.Item label="First Receive">
              {formatTimestamp(
                record.attributes.ApproximateFirstReceiveTimestamp
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Receive Count">
              {record.attributes.ApproximateReceiveCount || '0'}
            </Descriptions.Item>
          </Descriptions>

          {/* Message Body */}
          <div>
            <Title level={5}>Message Body</Title>
            <Card styles={{ body: { padding: 0 } }}>
              <Paragraph
                code
                copyable
                style={{
                  margin: 0,
                  padding: '12px',
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  maxHeight: '400px',
                  overflow: 'auto',
                }}
              >
                <pre style={{ margin: 0, fontFamily: 'monospace' }}>
                  {isJson ? formatJson(body) : record.body}
                </pre>
              </Paragraph>
            </Card>
          </div>

          {/* Message Attributes */}
          {record.messageAttributes &&
            Object.keys(record.messageAttributes).length > 0 && (
              <div>
                <Title level={5}>Message Attributes</Title>
                <Card styles={{ body: { padding: 0 } }}>
                  <Paragraph
                    code
                    copyable
                    style={{
                      margin: 0,
                      padding: '12px',
                      backgroundColor: '#1e1e1e',
                      color: '#d4d4d4',
                    }}
                  >
                    <pre style={{ margin: 0, fontFamily: 'monospace' }}>
                      {formatJson(record.messageAttributes)}
                    </pre>
                  </Paragraph>
                </Card>
              </div>
            )}
        </Space>
      </div>
    );
  };

  if (!name) {
    return (
      <div className="p-6">
        <Card>
          <Text type="danger">Queue name is required</Text>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '600',
          margin: 0,
          marginBottom: '8px',
          color: '#262626'
        }}>
          <InboxOutlined style={{ marginRight: '12px' }} />
          Queue Details
        </h1>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          Viewing messages for queue: <Text strong>{name}</Text>
        </Text>
      </div>

      {/* Queue Info Card */}
      {queueInfo && (
        <Card style={{ marginBottom: '16px', borderRadius: '8px' }}>
          <Descriptions
            title="Queue Information"
            bordered
            size="small"
            column={2}
          >
            <Descriptions.Item label="Queue Name" span={2}>
              <Text code copyable>{queueInfo.name}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Queue URL" span={2}>
              <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
                <Text code copyable ellipsis>
                  {queueInfo.url}
                </Text>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color={queueTypeConfig[queueInfo.type as keyof typeof queueTypeConfig]?.color || 'default'}>
                {queueTypeConfig[queueInfo.type as keyof typeof queueTypeConfig]?.label || queueInfo.type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Messages">
              <Badge count={queueInfo.messageCount} showZero overflowCount={9999} />
            </Descriptions.Item>
            <Descriptions.Item label="In Flight">
              <Badge count={queueInfo.messagesInFlight} showZero overflowCount={9999} />
            </Descriptions.Item>
            {queueInfo.oldestMessageAge && (
              <Descriptions.Item label="Oldest Message Age">
                {formatAge(queueInfo.oldestMessageAge)}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* Actions and Filters */}
      <Card style={{ marginBottom: '16px', borderRadius: '8px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Search
              ref={searchInputRef}
              placeholder="Search messages by ID, body, or preview... (Press / to focus)"
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
              size="large"
            />
          </Col>
          <Col xs={24} lg={12} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
            <Space wrap>
              <Text strong>
                Showing {filteredMessages.length} of {totalCount} message{totalCount !== 1 ? 's' : ''}
              </Text>
              {totalCount > 10 && (
                <Text type="secondary">(limited to 10 per page)</Text>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Batch Actions and Action Buttons */}
      <Card style={{ marginBottom: '16px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {selectedRowKeys.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <Text strong>{selectedRowKeys.length} selected</Text>
              <Space wrap size="small">
                {isDLQ && mainQueueName && (
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleBatchRedrive}
                    loading={isBatchRedriving}
                    size="small"
                  >
                    Move to Main Queue
                  </Button>
                )}
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleBatchDelete}
                  loading={isBatchDeleting}
                  size="small"
                >
                  Delete Selected
                </Button>
                <Button
                  onClick={() => setSelectedRowKeys([])}
                  size="small"
                >
                  Clear
                </Button>
              </Space>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '8px' }}>
            <Space wrap size="small">
              <Tooltip title="Show keyboard shortcuts (Shift + ?)">
                <Button
                  icon={<QuestionCircleOutlined />}
                  onClick={() => setShowShortcutsHelp(true)}
                />
              </Tooltip>
              <Tooltip title={autoRefresh ? `Auto-refreshing every ${refreshInterval}s` : 'Auto-refresh paused'}>
                <Button
                  icon={autoRefresh ? <SyncOutlined spin /> : <PauseCircleOutlined />}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  type={autoRefresh ? 'primary' : 'default'}
                >
                  {autoRefresh ? 'Auto' : 'Manual'}
                </Button>
              </Tooltip>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportMessages}
                disabled={filteredMessages.length === 0}
              >
                Export {selectedRowKeys.length > 0 ? 'Selected' : 'All'}
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={handlePurgeQueue}
                loading={isPurging}
                danger
                size="large"
              >
                Purge Queue
              </Button>
              <Button
                icon={<ReloadOutlined spin={isLoading} />}
                onClick={() => refetch()}
                loading={isLoading}
                size="large"
              >
                Refresh
              </Button>
            </Space>
          </div>
        </div>
      </Card>

      {/* Messages Table */}
      <Card style={{ borderRadius: '8px' }}>
        <Table
          dataSource={filteredMessages}
          columns={columns}
          rowKey="messageId"
          loading={isLoading}
          scroll={{ x: 800 }} // Enable horizontal scroll on mobile
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE,
            ],
          }}
          expandable={{
            expandedRowRender,
            expandedRowKeys,
            onExpandedRowsChange: (keys) =>
              setExpandedRowKeys(keys as string[]),
            showExpandColumn: false,
            expandRowByClick: false, // Disable row click expansion
          }}
          onRow={() => ({
            onClick: (e) => {
              // Prevent row click from doing anything
              e.stopPropagation();
            },
          })}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} messages`,
            responsive: true,
          }}
          locale={{
            emptyText: 'No messages in this queue',
          }}
        />
      </Card>

      {/* Purge Queue Confirmation Modal */}
      <Modal
        title="Purge Queue - Confirmation Required"
        open={showPurgeModal}
        onOk={handlePurgeConfirm}
        onCancel={() => {
          setShowPurgeModal(false);
          setPurgeConfirmText('');
        }}
        okText="Purge Queue"
        okType="danger"
        okButtonProps={{
          disabled: purgeConfirmText !== name,
          loading: isPurging,
        }}
        cancelButtonProps={{
          disabled: isPurging,
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <p>Are you sure you want to purge all messages from this queue?</p>
          <p><strong>Queue: {name}</strong></p>
          <p style={{ color: '#ff4d4f', marginTop: '12px' }}>
            <WarningOutlined /> <strong>Warning:</strong> This action cannot be undone. All messages in the queue will be permanently deleted.
          </p>
        </div>
        <div>
          <Text strong>Type the queue name to confirm:</Text>
          <Input
            value={purgeConfirmText}
            onChange={(e) => setPurgeConfirmText(e.target.value)}
            placeholder={`Type "${name}" to confirm`}
            onPressEnter={() => {
              if (purgeConfirmText === name) {
                handlePurgeConfirm();
              }
            }}
            autoFocus
            style={{ marginTop: '8px' }}
          />
          {purgeConfirmText && purgeConfirmText !== name && (
            <Text type="danger" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
              Queue name does not match
            </Text>
          )}
        </div>
      </Modal>

      {/* Keyboard Shortcuts Help Modal */}
      <Modal
        title="Keyboard Shortcuts"
        open={showShortcutsHelp}
        onCancel={() => setShowShortcutsHelp(false)}
        footer={null}
        width={500}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={<Text keyboard>r</Text>}>
            Refresh messages
          </Descriptions.Item>
          <Descriptions.Item label={<Text keyboard>/</Text>}>
            Focus search input
          </Descriptions.Item>
          <Descriptions.Item label={<Text keyboard>a</Text>}>
            Toggle auto-refresh
          </Descriptions.Item>
          <Descriptions.Item label={<Text keyboard>Esc</Text>}>
            Clear selection
          </Descriptions.Item>
          <Descriptions.Item label={<Text keyboard>Shift + ?</Text>}>
            Show this help
          </Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Press <Text keyboard>Esc</Text> or click outside to close
          </Text>
        </div>
      </Modal>
    </div>
  );
};
