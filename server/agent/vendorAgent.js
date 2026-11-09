// A friendly balance reminder from a vendor to a couple (the vendor reviews and sends it).
import { generateText } from 'ai';
import { defaultModels, fallbackModel } from '../models.js';
export async function draftVendorReminder({ vendor, booking }) {
  const model = fallbackModel(await defaultModels());
  const { text } = await generateText({
    model,
    maxRetries: 0,
    temperature: 0.3,
    maxTokens: 200,
    system:
      'Write one friendly, low-pressure payment reminder (max 350 characters) from a wedding vendor to a couple. Warm, like a heads-up from a friend, never a demand. Mention what it is for. No placeholders, no sign-off name.',
    prompt: `Vendor: ${vendor.name}. Couple: ${booking.couple}. Booking: ${booking.itemName}. Balance due: S$${booking.balance.toLocaleString('en-SG')} (deposit of S$${booking.deposit.toLocaleString('en-SG')} already paid).`,
  });
  return text.trim().slice(0, 400);
}
