import { useLogin } from '@refinedev/core';
import { Card, Form, Input, Button, Typography } from 'antd';

const { Title, Text } = Typography;

export const LoginPage = () => {
  const { mutate: login } = useLogin();

  const onFinish = (values: { token: string }) => {
    login(values);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <Title level={2}>Mailflow Dashboard</Title>
          <Text type="secondary">Enter your JWT token to continue</Text>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="token"
            rules={[{ required: true, message: 'Please enter your JWT token' }]}
          >
            <Input.TextArea
              placeholder="Paste JWT token here"
              rows={4}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              Login
            </Button>
          </Form.Item>
        </Form>

        <div className="mt-4 text-center">
          <Text type="secondary" className="text-xs">
            Contact your administrator for access credentials
          </Text>
        </div>
      </Card>
    </div>
  );
};
