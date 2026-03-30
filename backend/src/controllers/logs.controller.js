import Message from "../models/message.model.js";

export const getLogs = async (req, res, next) => {
  try {
    const { status, phone, templateId, limit = 100 } = req.query;
    const filter = {
      ownerId: req.user.id
    };

    if (status) {
      filter.status = status;
    }

    if (phone) {
      filter.phone = { $regex: String(phone), $options: "i" };
    }

    if (templateId) {
      filter.templateId = templateId;
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const logs = await Message.find(filter)
      .populate("templateId", "name language status")
      .sort({ createdAt: -1 })
      .limit(parsedLimit);

    return res.json(logs);
  } catch (error) {
    return next(error);
  }
};

export const getLogStats = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    const [totalMessages, sentMessages, failedMessages] = await Promise.all([
      Message.countDocuments({ ownerId }),
      Message.countDocuments({ ownerId, status: "sent" }),
      Message.countDocuments({ ownerId, status: "failed" })
    ]);

    const successRate = totalMessages > 0
      ? Math.round((sentMessages / totalMessages) * 100)
      : 0;

    return res.json({
      totalMessages,
      sentMessages,
      failedMessages,
      successRate
    });
  } catch (error) {
    return next(error);
  }
};