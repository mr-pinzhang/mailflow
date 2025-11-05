import { useState, useEffect } from 'react';
import { useCustom } from '@refinedev/core';
import { Card, Form, Button, Select, DatePicker, Table, Tag, Input, Alert, Typography } from 'antd';
import { SearchOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';

const { RangePicker } = DatePicker;
const { Text } = Typography;

export const LogsPage = () => {
  const [searchParams] = useSearchParams();
  const [queryParams, setQueryParams] = useState<any>(null);
  const [form] = Form.useForm();

  // Check for messageId in URL params
  useEffect(() => {
    const messageId = searchParams.get('messageId');
    if (messageId) {
      form.setFieldsValue({ searchPattern: messageId });
      // Auto-trigger search
      setTimeout(() => {
        const params = {
          logGroup: '/aws/lambda/mailflow-dev',
          startTime: dayjs().subtract(24, 'hour').toISOString(),
          endTime: dayjs().toISOString(),
          filterPattern: messageId,
          limit: 100,
        };
        setQueryParams(params);
      }, 100);
    }
  }, [searchParams, form]);

  const { query } = useCustom({
    url: '/logs/query',
    method: 'post',
    config: {
      payload: queryParams,
    },
    queryOptions: {
      enabled: !!queryParams,
    },
  });

  const { data, isLoading, refetch } = query;

  const handleRefresh = () => {
    if (queryParams) {
      refetch();
    }
  };

  const onFinish = (values: any) => {
    // Combine level filter with custom search pattern
    let filterPattern = values.searchPattern || '';

    // If level is not ALL, prepend it to the pattern
    if (values.level !== 'ALL') {
      filterPattern = filterPattern
        ? `${values.level} ${filterPattern}`
        : values.level;
    }

    const params = {
      logGroup: '/aws/lambda/mailflow-dev',
      startTime: values.timeRange ? values.timeRange[0].toISOString() : dayjs().subtract(24, 'hour').toISOString(),
      endTime: values.timeRange ? values.timeRange[1].toISOString() : dayjs().toISOString(),
      filterPattern: filterPattern || undefined,
      limit: 100,
    };
    setQueryParams(params);
  };

  const handleExportJSON = () => {
    if (!logs.length) {
      return;
    }

    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mailflow-logs-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const logs: any[] = data?.data?.logs || [];

  const columns = [
    { title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp', width: 180 },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => {
        const color = level === 'ERROR' ? 'red' : level === 'WARN' ? 'orange' : level === 'INFO' ? 'blue' : 'default';
        return <Tag color={color}>{level}</Tag>;
      },
    },
    { title: 'Message', dataIndex: 'message', key: 'message', ellipsis: true },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Logs Viewer</h1>

      <Alert
        message="Search Tips"
        description={
          <div>
            <Text>Search by message ID, correlation ID, or any text pattern. Examples:</Text>
            <ul className="mt-2 ml-4">
              <li><code>message_id:msg-123</code> - Find logs for specific message</li>
              <li><code>correlation_id:abc-def</code> - Find related logs</li>
              <li><code>Failed to send</code> - Search for error messages</li>
            </ul>
          </div>
        }
        type="info"
        closable
        className="mb-4"
      />

      <Card>
        <Form layout="vertical" onFinish={onFinish} form={form}>
          <div className="flex gap-4 flex-wrap">
            <Form.Item name="timeRange" label="Time Range" style={{ flex: '1 1 300px' }}>
              <RangePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="level" initialValue="ALL" label="Log Level" style={{ flex: '0 1 150px' }}>
              <Select>
                <Select.Option value="ALL">All</Select.Option>
                <Select.Option value="ERROR">Error</Select.Option>
                <Select.Option value="WARN">Warn</Select.Option>
                <Select.Option value="INFO">Info</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item
            name="searchPattern"
            label="Search Pattern"
            extra="Enter keywords, message ID, correlation ID, or CloudWatch Logs filter syntax"
          >
            <Input
              placeholder="e.g., message_id:msg-123 or 'Failed to process'"
              allowClear
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              Query Logs
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={`Logs (${logs.length})`}
        extra={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              icon={<ReloadOutlined spin={isLoading} />}
              onClick={handleRefresh}
              disabled={!queryParams}
              loading={isLoading}
            >
              Refresh
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportJSON}
              disabled={logs.length === 0}
            >
              Export JSON
            </Button>
          </div>
        }
      >
        <Table
          dataSource={logs}
          columns={columns}
          loading={isLoading}
          rowKey={(record) => `${record.timestamp}-${record.message || ''}-${Math.random()}`}
          pagination={{ pageSize: 50 }}
          expandable={{
            expandedRowRender: (record) => (
              <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(record.context || record, null, 2)}
              </pre>
            ),
          }}
        />
      </Card>
    </div>
  );
};
