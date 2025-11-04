import { useCustom } from '@refinedev/core';
import { Card, Table, Button, Spin } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

export const StoragePage = () => {
  const { query: statsQuery } = useCustom({
    url: '/storage/stats',
    method: 'get',
  });

  const { data: statsData, isLoading: statsLoading } = statsQuery;
  const buckets = statsData?.data?.buckets || [];
  const firstBucket = buckets[0]?.name;

  const { query: objectsQuery } = useCustom({
    url: `/storage/${firstBucket}/objects`,
    method: 'get',
    queryOptions: {
      enabled: !!firstBucket,
    },
  });

  const { data: objectsData, isLoading: objectsLoading } = objectsQuery;

  const objects = objectsData?.data?.objects || [];

  const columns = [
    { title: 'Object Key', dataIndex: 'key', key: 'key' },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    { title: 'Last Modified', dataIndex: 'lastModified', key: 'lastModified' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          icon={<DownloadOutlined />}
          onClick={() => window.open(record.presignedUrl, '_blank')}
        >
          Download
        </Button>
      ),
    },
  ];

  if (statsLoading) return <Spin size="large" />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Storage Browser</h1>

      <Card title="Recent Objects">
        <Table
          dataSource={objects}
          columns={columns}
          loading={objectsLoading}
          rowKey="key"
        />
      </Card>
    </div>
  );
};
