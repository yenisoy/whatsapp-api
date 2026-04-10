import { Queue } from "bullmq";

const getRedisConnection = () => ({
  host: process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT || 6379)
});

export const SEND_BATCH_QUEUE_NAME = "send-batch";

export const sendBatchQueue = new Queue(SEND_BATCH_QUEUE_NAME, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 200,
    removeOnFail: 500
  }
});

export const enqueueBatchSendJob = async (payload) => {
  return sendBatchQueue.add("send-one", payload);
};

export const getQueueConnection = getRedisConnection;
