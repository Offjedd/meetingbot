export type MeetingPlatform = "google" | "zoom" | "teams";

export interface MeetingInfo {
  platform: MeetingPlatform;
  meetingUrl?: string;
  meetingId?: string;
  meetingPassword?: string;
  organizerId?: string;
  tenantId?: string;
}

export interface Bot {
  id: number;
  user_id: string;
  meeting_url: string;
  platform: MeetingPlatform;
  title: string;
  status: string;
  recording_url: string | null;
  scheduled_at: string | null;
  youtube_url: string | null;
  youtube_status: string | null;
  heartbeat: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotEvent {
  id: number;
  bot_id: number;
  event_type: string;
  event_data: Record<string, unknown> | null;
  event_time: string;
}

export interface Transcript {
  id: number;
  bot_id: number;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}
