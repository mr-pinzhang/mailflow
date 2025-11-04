import { useCustom } from '@refinedev/core';
import { Card, Descriptions, Spin, Alert } from 'antd';

export const ConfigPage = () => {
  const { query } = useCustom({
    url: '/config',
    method: 'get',
  });

  const { data, isLoading, error } = query;

  if (isLoading) return <Spin size="large" />;
  if (error) return <Alert message="Error" description={error.message} type="error" />;

  const config = data?.data;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Configuration</h1>

      <Alert
        message="Read-Only Configuration"
        description="To change configuration, update Pulumi code and redeploy"
        type="info"
        showIcon
      />

      <Card title="System Configuration">
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Version">{config?.version}</Descriptions.Item>
          <Descriptions.Item label="Source">{config?.source}</Descriptions.Item>
          <Descriptions.Item label="Bucket">{config?.attachments?.bucket}</Descriptions.Item>
          <Descriptions.Item label="Max Attachment Size">
            {config?.attachments?.maxSize ? `${(config.attachments.maxSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Security Settings">
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Require SPF">{config?.security?.requireSpf ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="Require DKIM">{config?.security?.requireDkim ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="Require DMARC">{config?.security?.requireDmarc ? 'Yes' : 'No'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};
