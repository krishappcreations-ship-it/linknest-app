/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock supabase client BEFORE importing realtime-runtime.
type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE";
type RealtimePayload = {
  eventType?: RealtimeEventType;
  new: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};
type SubEntry = {
  table: string;
  filter: string;
  cb: (p: RealtimePayload) => void;
};
type MockChannel = {
  name: string;
  subs: SubEntry[];
  onStatus: ((status: string) => void) | null;
  on: (
    _event: string,
    opts: { table: string; filter: string },
    cb: (p: RealtimePayload) => void
  ) => MockChannel;
  subscribe: (cb: (status: string) => void) => MockChannel;
};

const { channelMocks, makeChannel, removeChannelMock } = vi.hoisted(() => {
  const channelMocks: MockChannel[] = [];
  function makeChannel(name: string): MockChannel {
    const ch: MockChannel = {
      name,
      subs: [],
      onStatus: null,
      on(_event, opts, cb) {
        this.subs.push({ table: opts.table, filter: opts.filter, cb });
        return this;
      },
      subscribe(cb) {
        this.onStatus = cb;
        return this;
      },
    };
    channelMocks.push(ch);
    return ch;
  }
  return {
    channelMocks,
    makeChannel,
    removeChannelMock: vi.fn(async () => "ok"),
  };
});

const {
  applyInboundBookmarkMock,
  applyInboundFolderMock,
  applyInboundTagMock,
  applyDeleteBookmarkMock,
  applyDeleteFolderMock,
  applyDeleteTagMock,
  triggerSyncOnStartupMock,
  emitRealtimeDownToastMock,
} = vi.hoisted(() => ({
  applyInboundBookmarkMock: vi.fn(async () => true),
  applyInboundFolderMock: vi.fn(async () => true),
  applyInboundTagMock: vi.fn(async () => true),
  applyDeleteBookmarkMock: vi.fn(async () => true),
  applyDeleteFolderMock: vi.fn(async () => true),
  applyDeleteTagMock: vi.fn(async () => true),
  triggerSyncOnStartupMock: vi.fn(async () => undefined),
  emitRealtimeDownToastMock: vi.fn(),
}));

vi.mock("@/lib/sync/supabase-client", () => ({
  getSupabaseClient: () => ({
    channel: (name: string) => makeChannel(name),
    removeChannel: removeChannelMock,
  }),
}));

vi.mock("@/lib/sync/sync-runtime", () => ({
  applyInboundBookmark: applyInboundBookmarkMock,
  applyInboundFolder: applyInboundFolderMock,
  applyInboundTag: applyInboundTagMock,
  applyDeleteBookmark: applyDeleteBookmarkMock,
  applyDeleteFolder: applyDeleteFolderMock,
  applyDeleteTag: applyDeleteTagMock,
  triggerSyncOnStartup: triggerSyncOnStartupMock,
  emitRealtimeDownToast: emitRealtimeDownToastMock,
}));

vi.mock("@/lib/sync/supabase-sync", () => ({
  bookmarkFromRow: (r: any) => ({ ...r, _kind: "bookmark" }),
  folderFromRow: (r: any) => ({ ...r, _kind: "folder" }),
  tagFromRow: (r: any) => ({ ...r, _kind: "tag" }),
}));

import { mountRealtime, teardownRealtime } from "@/lib/sync/realtime-runtime";

describe("realtime-runtime (F13)", () => {
  beforeEach(() => {
    teardownRealtime();
    channelMocks.length = 0;
    removeChannelMock.mockClear();
    applyInboundBookmarkMock.mockClear();
    applyInboundFolderMock.mockClear();
    applyInboundTagMock.mockClear();
    applyDeleteBookmarkMock.mockClear();
    applyDeleteFolderMock.mockClear();
    applyDeleteTagMock.mockClear();
    triggerSyncOnStartupMock.mockClear();
    emitRealtimeDownToastMock.mockClear();
  });

  it("mountRealtime creates 3 channels with user_id filter", () => {
    mountRealtime("user-123");
    expect(channelMocks).toHaveLength(3);
    expect(channelMocks[0].name).toBe("bookmarks:user-123");
    expect(channelMocks[1].name).toBe("folders:user-123");
    expect(channelMocks[2].name).toBe("tags:user-123");
    expect(channelMocks[0].subs[0]).toMatchObject({
      table: "bookmarks",
      filter: "user_id=eq.user-123",
    });
    expect(channelMocks[1].subs[0].filter).toBe("user_id=eq.user-123");
    expect(channelMocks[2].subs[0].filter).toBe("user_id=eq.user-123");
  });

  it("mountRealtime is idempotent (double call → still 3 channels)", () => {
    mountRealtime("user-123");
    mountRealtime("user-123");
    expect(channelMocks).toHaveLength(3);
  });

  it("dispatches bookmark event to applyInboundBookmark via bookmarkFromRow", () => {
    mountRealtime("user-123");
    channelMocks[0].subs[0].cb({ new: { id: "b1", url: "x" } });
    expect(applyInboundBookmarkMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b1", _kind: "bookmark" })
    );
  });

  it("dispatches folder event to applyInboundFolder", () => {
    mountRealtime("user-123");
    channelMocks[1].subs[0].cb({ new: { id: "f1" } });
    expect(applyInboundFolderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "f1", _kind: "folder" })
    );
  });

  it("dispatches tag event to applyInboundTag", () => {
    mountRealtime("user-123");
    channelMocks[2].subs[0].cb({ new: { id: "t1" } });
    expect(applyInboundTagMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", _kind: "tag" })
    );
  });

  it("ignores payload with null new (defensive)", () => {
    mountRealtime("user-123");
    channelMocks[0].subs[0].cb({ new: null });
    expect(applyInboundBookmarkMock).not.toHaveBeenCalled();
  });

  it("onStatus resets reconnect counter + triggers safety-net pull on re-SUBSCRIBED after error", () => {
    mountRealtime("user-123");
    const onStatus = channelMocks[0].onStatus!;
    onStatus("CHANNEL_ERROR");
    onStatus("CHANNEL_ERROR");
    onStatus("SUBSCRIBED");
    expect(triggerSyncOnStartupMock).toHaveBeenCalledTimes(1);
  });

  it("first SUBSCRIBED with no prior errors does NOT trigger safety-net pull", () => {
    mountRealtime("user-123");
    channelMocks[0].onStatus!("SUBSCRIBED");
    expect(triggerSyncOnStartupMock).not.toHaveBeenCalled();
  });

  it("emits realtime-down toast after MAX_RECONNECT (3) failures", () => {
    mountRealtime("user-123");
    const onStatus = channelMocks[0].onStatus!;
    onStatus("CHANNEL_ERROR");
    onStatus("TIMED_OUT");
    expect(emitRealtimeDownToastMock).not.toHaveBeenCalled();
    onStatus("CHANNEL_ERROR");
    expect(emitRealtimeDownToastMock).toHaveBeenCalledTimes(1);
  });

  it("teardownRealtime calls removeChannel × 3 + clears module state", () => {
    mountRealtime("user-123");
    teardownRealtime();
    expect(removeChannelMock).toHaveBeenCalledTimes(3);
    channelMocks.length = 0;
    mountRealtime("user-123");
    expect(channelMocks).toHaveLength(3);
  });

  it("teardownRealtime is safe to call when not mounted", () => {
    expect(() => teardownRealtime()).not.toThrow();
    expect(removeChannelMock).not.toHaveBeenCalled();
  });

  it("dispatches DELETE event to applyDeleteBookmark via payload.old.id (F16)", () => {
    mountRealtime("user-123");
    channelMocks[0].subs[0].cb({
      eventType: "DELETE",
      old: { id: "b1" },
      new: null,
    });
    expect(applyDeleteBookmarkMock).toHaveBeenCalledWith("b1");
    expect(applyInboundBookmarkMock).not.toHaveBeenCalled();
  });

  it("ignores DELETE event with missing or non-string id (F16 defensive)", () => {
    mountRealtime("user-123");
    channelMocks[0].subs[0].cb({
      eventType: "DELETE",
      old: {},
      new: null,
    });
    expect(applyDeleteBookmarkMock).not.toHaveBeenCalled();
  });
});
