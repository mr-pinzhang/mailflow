import { useLogin } from '@refinedev/core';
import { Card, Form, Input, Button, Typography } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export const LoginPage = () => {
  const { mutate: login } = useLogin();

  const onFinish = (values: { token: string }) => {
    login(values);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: 'none',
        }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div className="text-center mb-8">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              marginBottom: '24px',
            }}
          >
            <MailOutlined style={{ fontSize: '32px', color: 'white' }} />
          </div>
          <Title level={2} style={{ marginBottom: '8px', fontSize: '28px', fontWeight: 600 }}>
            Mailflow Dashboard
          </Title>
          <Text type="secondary" style={{ fontSize: '15px' }}>
            Enter your JWT token to continue
          </Text>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="token"
            label={
              <span style={{ fontSize: '14px', fontWeight: 500 }}>
                <LockOutlined style={{ marginRight: '6px' }} />
                JWT Token
              </span>
            }
            rules={[{ required: true, message: 'Please enter your JWT token' }]}
          >
            <Input.TextArea
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              rows={6}
              autoSize={{ minRows: 6, maxRows: 10 }}
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '12px',
                borderRadius: '8px',
                resize: 'none',
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              style={{
                height: '48px',
                fontSize: '16px',
                fontWeight: 500,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
            >
              Login
            </Button>
          </Form.Item>
        </Form>

        <div className="mt-8 text-center">
          <Text type="secondary" style={{ fontSize: '13px' }}>
            Contact your administrator for access credentials
          </Text>
        </div>
      </Card>
    </div>
  );
};
