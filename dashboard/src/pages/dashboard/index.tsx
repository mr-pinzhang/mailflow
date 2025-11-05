import { useCustom } from '@refinedev/core';
import { Card, Row, Col, Statistic, Badge, Alert, Spin } from 'antd';
import { MailOutlined, ThunderboltOutlined, ExclamationCircleOutlined, InboxOutlined, WarningOutlined } from '@ant-design/icons';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const DashboardPage = () => {
  // Fetch summary metrics
  const { query } = useCustom({
    url: '/metrics/summary',
    method: 'get',
    queryOptions: {
      refetchInterval: 30000, // Auto-refresh every 30s
    },
  });

  // Fetch inbound timeseries data
  const { query: inboundQuery } = useCustom({
    url: '/metrics/timeseries',
    method: 'get',
    meta: {
      query: {
        metric: 'inbound_received',
        period: '24h',
        interval: '1h',
      },
    },
    queryOptions: {
      refetchInterval: 30000,
    },
  });

  // Fetch outbound timeseries data
  const { query: outboundQuery } = useCustom({
    url: '/metrics/timeseries',
    method: 'get',
    meta: {
      query: {
        metric: 'outbound_sent',
        period: '24h',
        interval: '1h',
      },
    },
    queryOptions: {
      refetchInterval: 30000,
    },
  });

  const { data, isLoading, error } = query;
  const isChartLoading = inboundQuery.isLoading || outboundQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large">
          <div style={{ padding: '50px' }}>Loading dashboard...</div>
        </Spin>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Dashboard"
        description={error.message}
        type="error"
        showIcon
      />
    );
  }

  const metrics = data?.data;
  const isDlqAlert = (metrics?.queues?.dlqMessages ?? 0) > 0;

  // Transform timeseries data for chart
  const inboundData = inboundQuery.data?.data?.datapoints || [];
  const outboundData = outboundQuery.data?.data?.datapoints || [];

  // Merge inbound and outbound data by timestamp
  const chartData = inboundData.map((point: any, index: number) => {
    const timestamp = new Date(point.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      timestamp,
      inbound: point.value || 0,
      outbound: outboundData[index]?.value || 0,
    };
  });

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '600',
          margin: 0,
          color: '#262626'
        }}>
          Dashboard Overview
        </h1>
        <Badge
          status={metrics?.period === '24h' ? 'success' : 'default'}
          text={`Last updated: ${new Date().toLocaleTimeString()}`}
          style={{ fontSize: '14px' }}
        />
      </div>

      {isDlqAlert && (
        <Alert
          message="DLQ Messages Detected"
          description={`There are ${metrics?.queues?.dlqMessages ?? 0} messages in the Dead Letter Queue requiring attention.`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: '24px' }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Total Emails (24h)"
              value={metrics?.inbound?.total + metrics?.outbound?.total || 0}
              prefix={<MailOutlined style={{ fontSize: '20px' }} />}
              valueStyle={{ color: '#1890ff', fontSize: '28px', fontWeight: '600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Processing Rate"
              value={((metrics?.inbound?.rate || 0) + (metrics?.outbound?.rate || 0)).toFixed(2)}
              suffix="emails/min"
              prefix={<ThunderboltOutlined style={{ fontSize: '20px' }} />}
              valueStyle={{ color: '#52c41a', fontSize: '28px', fontWeight: '600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Error Rate"
              value={((metrics?.inbound?.errorRate || 0) * 100).toFixed(2)}
              suffix="%"
              prefix={<ExclamationCircleOutlined style={{ fontSize: '20px' }} />}
              valueStyle={{
                color: (metrics?.inbound?.errorRate || 0) > 0.05 ? '#ff4d4f' : '#52c41a',
                fontSize: '28px',
                fontWeight: '600'
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Active Queues"
              value={metrics?.queues?.active || 0}
              prefix={<InboxOutlined style={{ fontSize: '20px' }} />}
              valueStyle={{ color: '#722ed1', fontSize: '28px', fontWeight: '600' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={<span style={{ fontSize: '18px', fontWeight: '500' }}>Email Processing (24h)</span>}
        style={{ borderRadius: '8px' }}
      >
        {isChartLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 300
          }}>
            <Spin size="large">
              <div style={{ padding: '50px' }}>Loading chart data...</div>
            </Spin>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" style={{ fontSize: '12px' }} />
              <YAxis style={{ fontSize: '12px' }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="inbound" stroke="#1890ff" fill="#1890ff" fillOpacity={0.6} name="Inbound" />
              <Area type="monotone" dataKey="outbound" stroke="#52c41a" fill="#52c41a" fillOpacity={0.6} name="Outbound" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};
