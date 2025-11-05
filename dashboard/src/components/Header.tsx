import { useLogout, useGetIdentity } from '@refinedev/core';
import { Layout, Dropdown, Avatar, Space, Typography } from 'antd';
import { UserOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

export const Header = () => {
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity();

  const items: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: () => logout(),
    },
  ];

  return (
    <AntHeader
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '0 24px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #f0f0f0',
        height: '64px',
      }}
    >
      <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
        <Space
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '8px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Avatar
            size="small"
            icon={<UserOutlined />}
            style={{
              backgroundColor: '#667eea',
            }}
          />
          <Text strong style={{ fontSize: '14px' }}>
            {identity?.name || 'User'}
          </Text>
          <DownOutlined style={{ fontSize: '12px' }} />
        </Space>
      </Dropdown>
    </AntHeader>
  );
};
