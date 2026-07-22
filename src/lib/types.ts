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
  id: string;
  user_id: string;
  meeting_url: string | null;
  platform: MeetingPlatform;
  meeting_title: string | null;
  meeting_info: Record<string, unknown> | null;
  status: string;
  recording_url: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  youtube_video_id: string | null;
  youtube_upload_status: string | null;
  last_heartbeat: string | null;
  backend_bot_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface BotEvent {
  id: string;
  bot_id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  event_time: string;
}

export interface Transcript {
  id: string;
  bot_id: string;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}
