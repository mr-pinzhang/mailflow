import { TitleProps } from '@refinedev/core';
import { Typography } from 'antd';
import { MailOutlined } from '@ant-design/icons';

const { Text } = Typography;

export const Title: React.FC<TitleProps> = ({ collapsed }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        fontSize: collapsed ? '24px' : '20px',
        fontWeight: 700,
        color: '#1890ff',
      }}
    >
      <MailOutlined style={{ fontSize: collapsed ? '24px' : '28px' }} />
      {!collapsed && <Text strong style={{ fontSize: '18px', margin: 0 }}>Mailflow</Text>}
    </div>
  );
};
