import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FeedbackRequest } from "./types";

const configMock = vi.hoisted(() => ({
  config: {
    supabaseUrl: undefined as string | undefined,
    supabaseAnonKey: undefined as string | undefined,
    resendApiKey: undefined as string | undefined,
    feedbackNotificationEmail: undefined as string | undefined,
  },
  hasReportStorage: vi.fn(),
  hasFeedbackNotifications: vi.fn(),
}));
vi.mock("./config", () => configMock);

const insertMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() =>
  vi.fn(() => ({ from: vi.fn(() => ({ insert: insertMock })) }))
);
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

const sendMock = vi.hoisted(() => vi.fn());
const resendCtorMock = vi.hoisted(() =>
  vi.fn(function () {
    return { emails: { send: sendMock } };
  })
);
vi.mock("resend", () => ({ Resend: resendCtorMock }));

const { saveFeedback } = await import("./feedbackStore");

const feedback: FeedbackRequest = { category: "bug", message: "חיפשתי תמונה והייתה שגיאה", contactEmail: undefined };

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null });
  sendMock.mockReset().mockResolvedValue({ error: null });
  resendCtorMock.mockClear();
  configMock.hasReportStorage.mockReturnValue(true);
  configMock.hasFeedbackNotifications.mockReturnValue(false);
  configMock.config.supabaseUrl = "https://x.supabase.co";
  configMock.config.supabaseAnonKey = "anon-key";
  configMock.config.resendApiKey = undefined;
  configMock.config.feedbackNotificationEmail = undefined;
});

describe("saveFeedback", () => {
  it("saves without sending an email when notifications aren't configured", async () => {
    expect(await saveFeedback(feedback)).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends an email notification once the feedback is saved", async () => {
    configMock.hasFeedbackNotifications.mockReturnValue(true);
    configMock.config.resendApiKey = "re_test";
    configMock.config.feedbackNotificationEmail = "aviv2405@gmail.com";

    expect(await saveFeedback(feedback)).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "aviv2405@gmail.com", text: expect.stringContaining(feedback.message) })
    );
  });

  it("still reports success even when the notification email fails to send", async () => {
    configMock.hasFeedbackNotifications.mockReturnValue(true);
    configMock.config.resendApiKey = "re_test";
    configMock.config.feedbackNotificationEmail = "aviv2405@gmail.com";
    sendMock.mockRejectedValue(new Error("resend is down"));

    await expect(saveFeedback(feedback)).resolves.toBe(true);
  });

  it("never sends a notification when the Supabase insert itself fails", async () => {
    configMock.hasFeedbackNotifications.mockReturnValue(true);
    configMock.config.resendApiKey = "re_test";
    configMock.config.feedbackNotificationEmail = "aviv2405@gmail.com";
    insertMock.mockResolvedValue({ error: { message: "db down" } });

    expect(await saveFeedback(feedback)).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
