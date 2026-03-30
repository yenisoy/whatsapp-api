import Contact from "../models/contact.model.js";

export const runDataMigrations = async () => {
  try {
    const indexes = await Contact.collection.indexes();
    const legacyPhoneIndex = indexes.find((index) => index.name === "phone_1" && index.unique);

    if (legacyPhoneIndex) {
      await Contact.collection.dropIndex("phone_1");
    }
  } catch {
  }
};
