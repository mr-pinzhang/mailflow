import { useState } from 'react';
import { useCustom } from '@refinedev/core';
import { Card, Tabs, Form, Input, Button, Select, message, Alert, Table } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { apiClient } from '../../utils/api';

const { TextArea } = Input;

export const TestEmailPage = () => {
  const [result, setResult] = useState<any>(null);

  const { query: historyQuery } = useCustom({
    url: '/test/history',
    method: 'get',
  });

  const { data: historyData, refetch } = historyQuery;

  const [sendingInbound, setSendingInbound] = useState(false);
  const [sendingOutbound, setSendingOutbound] = useState(false);

  const onSendInbound = async (values: any) => {
    setSendingInbound(true);
    try {
      const response = await apiClient.post('/test/inbound', values);
      setResult(response.data);
      message.success('Test email sent successfully!');
      refetch();
    } catch (error: any) {
      message.error(error.message || 'Failed to send test email');
    } finally {
      setSendingInbound(false);
    }
  };

  const onSendOutbound = async (values: any) => {
    setSendingOutbound(true);
    try {
      const response = await apiClient.post('/test/outbound', values);
      setResult(response.data);
      message.success('Test email queued successfully!');
      refetch();
    } catch (error: any) {
      message.error(error.message || 'Failed to queue test email');
    } finally {
      setSendingOutbound(false);
    }
  };

  const historyColumns = [
    { title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Recipient', dataIndex: 'recipient', key: 'recipient' },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    { title: 'Message ID', dataIndex: 'messageId', key: 'messageId' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Test Email</h1>

      {result && (
        <Alert
          message={result.success ? 'Success' : 'Error'}
          description={result.success ? `Message ID: ${result.messageId}` : result.error}
          type={result.success ? 'success' : 'error'}
          closable
          onClose={() => setResult(null)}
        />
      )}

      <Card>
        <Tabs
          items={[
            {
              key: 'inbound',
              label: 'Inbound Test',
              children: (
                <Form layout="vertical" onFinish={onSendInbound}>
                  <Form.Item label="App" name="app" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="app1">app1</Select.Option>
                      <Select.Option value="app2">app2</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="From" name="from" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="test@example.com" />
                  </Form.Item>
                  <Form.Item label="Subject" name="subject" rules={[{ required: true }]}>
                    <Input placeholder="Test Subject" />
                  </Form.Item>
                  <Form.Item label="Body (Text)" name={['body', 'text']} rules={[{ required: true }]}>
                    <TextArea rows={4} placeholder="Email body..." />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={sendingInbound} icon={<SendOutlined />}>
                    Send Test Email
                  </Button>
                </Form>
              ),
            },
            {
              key: 'outbound',
              label: 'Outbound Test',
              children: (
                <Form layout="vertical" onFinish={onSendOutbound}>
                  <Form.Item label="From App" name="from" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="app1">app1</Select.Option>
                      <Select.Option value="app2">app2</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="To" name="to" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="recipient@example.com" />
                  </Form.Item>
                  <Form.Item label="Subject" name="subject" rules={[{ required: true }]}>
                    <Input placeholder="Test Subject" />
                  </Form.Item>
                  <Form.Item label="Body (Text)" name={['body', 'text']} rules={[{ required: true }]}>
                    <TextArea rows={4} placeholder="Email body..." />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={sendingOutbound} icon={<SendOutlined />}>
                    Queue Test Email
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Test History">
        <Table
          dataSource={historyData?.data?.tests || []}
          columns={historyColumns}
          rowKey="id"
        />
      </Card>
    </div>
  );
};
