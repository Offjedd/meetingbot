import { MeetingPlatform, MeetingInfo } from "./types";

export function detectPlatform(link: string): MeetingPlatform | null {
  if (link.includes("meet.google.com") || link.includes("meet.google")) {
    return "google";
  }
  if (link.includes("zoom.us") || link.includes("zoom.")) {
    return "zoom";
  }
  if (link.includes("teams.microsoft.com") || link.includes("teams.live.com")) {
    return "teams";
  }
  return null;
}

export function defineMeetingInfo(
  link: string,
  platform: MeetingPlatform
): MeetingInfo | null {
  try {
    if (platform === "google") {
      return { platform, meetingUrl: link };
    }

    if (platform === "zoom") {
      const url = new URL(link);
      const pathParts = url.pathname.split("/");
      const meetingId = pathParts[pathParts.length - 1];
      const meetingPassword = url.searchParams.get("pwd") || undefined;
      return { platform, meetingId, meetingPassword, meetingUrl: link };
    }

    if (platform === "teams") {
      const url = new URL(link);
      const pathParts = url.pathname.split("/");
      const meetingId = pathParts.find((p) => p.startsWith("19:")) || pathParts[pathParts.length - 1];
      const contextParam = url.searchParams.get("context");
      let tenantId: string | undefined;
      let organizerId: string | undefined;
      if (contextParam) {
        try {
          const ctx = JSON.parse(decodeURIComponent(contextParam));
          tenantId = ctx.Tid;
          organizerId = ctx.Oid;
        } catch {}
      }
      return { platform, meetingId, tenantId, organizerId, meetingUrl: link };
    }

    return null;
  } catch {
    return null;
  }
}

export function checkMeetBotLink(link: string): boolean {
  return /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/.test(link);
}

export function checkZoomBotLink(link: string): boolean {
  return /zoom\.(us|com?)\/j\/\d+/.test(link);
}

export function checkTeamsBotLink(link: string): boolean {
  return link.includes("teams.microsoft.com") || link.includes("teams.live.com");
}
