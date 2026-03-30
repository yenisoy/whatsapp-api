import { Queue } from "bullmq";

const getRedisConnection = () => ({
  host: process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT || 6379)
});

export const SEND_BULK_QUEUE_NAME = "send-bulk";

export const sendBulkQueue = new Queue(SEND_BULK_QUEUE_NAME, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 200,
    removeOnFail: 500
  }
});

export const enqueueBulkSendJob = async (payload) => {
  return sendBulkQueue.add("send-one", payload);
};

export const getQueueConnection = getRedisConnection;
