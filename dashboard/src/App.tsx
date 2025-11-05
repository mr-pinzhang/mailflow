import { Refine } from '@refinedev/core';
import { RefineThemes, ThemedLayout, useNotificationProvider } from '@refinedev/antd';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import routerProvider from '@refinedev/react-router';
import { ConfigProvider, App as AntApp } from 'antd';
import {
  InboxOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import { authProvider } from './providers/authProvider';
import { dataProvider } from './providers/dataProvider';

// Components
import { Header, Title } from './components';

// Pages
import { QueuesPage, QueueDetailPage } from './pages/queues';
import { LogsPage } from './pages/logs';
import { StoragePage } from './pages/storage';
import { TestEmailPage } from './pages/test';
import { ConfigPage } from './pages/config';
import { LoginPage } from './pages/login';

import '@refinedev/antd/dist/reset.css';

function App() {
  return (
    <BrowserRouter>
      <ConfigProvider theme={RefineThemes.Blue}>
        <AntApp>
          <Refine
            routerProvider={routerProvider}
            dataProvider={dataProvider}
            authProvider={authProvider}
            notificationProvider={useNotificationProvider}
            resources={[
              {
                name: 'queues',
                list: '/queues',
                show: '/queues/:name',
                meta: {
                  label: 'Queues',
                  icon: <InboxOutlined />,
                },
              },
              {
                name: 'logs',
                list: '/logs',
                meta: {
                  label: 'Logs',
                  icon: <FileTextOutlined />,
                },
              },
              {
                name: 'storage',
                list: '/storage',
                meta: {
                  label: 'Storage',
                  icon: <DatabaseOutlined />,
                },
              },
              {
                name: 'test',
                list: '/test',
                meta: {
                  label: 'Test Email',
                  icon: <ExperimentOutlined />,
                },
              },
              {
                name: 'config',
                list: '/config',
                meta: {
                  label: 'Configuration',
                  icon: <SettingOutlined />,
                },
              },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
            }}
          >
            <Routes>
              <Route
                element={
                  <ThemedLayout Header={Header} Title={Title}>
                    <Outlet />
                  </ThemedLayout>
                }
              >
                <Route index element={<QueuesPage />} />
                <Route path="/queues" element={<QueuesPage />} />
                <Route path="/queues/:name" element={<QueueDetailPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/storage" element={<StoragePage />} />
                <Route path="/test" element={<TestEmailPage />} />
                <Route path="/config" element={<ConfigPage />} />
              </Route>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </Refine>
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
