import Contact from "../models/contact.model.js";
import User from "../models/user.model.js";
import { ensureUserWebhookCredentials } from "../services/user-webhook.service.js";

export const runDataMigrations = async () => {
  try {
    const indexes = await Contact.collection.indexes();
    const legacyPhoneIndex = indexes.find((index) => index.name === "phone_1" && index.unique);

    if (legacyPhoneIndex) {
      await Contact.collection.dropIndex("phone_1");
    }
  } catch {
  }

  try {
    const users = await User.find({});
    await Promise.all(
      users.map(async (user) => {
        const changed = ensureUserWebhookCredentials(user);
        if (changed) {
          await user.save();
        }
      })
    );
  } catch {
  }
};
