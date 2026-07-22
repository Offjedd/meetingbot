import type { MeetingInfo, MeetingPlatform } from "./types";

export function checkMeetBotLink(link: string): boolean {
  return /^((https:\/\/)?meet\.google\.com\/)?[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(
    link,
  );
}

export function checkZoomBotLink(link: string): boolean {
  return /^https:\/\/[a-z0-9]+\.zoom\.us\/j\/[0-9]{9,11}(?:\?pwd=[^&]+)?$/.test(
    link,
  );
}

function parseTeamsMeetingLink(
  url: string,
): { meetingId: string; tenantId: string; organizationId: string } | null {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split("/");

    let meetingId: string | null = null;
    const meetingSegment = pathSegments.find((segment) =>
      segment.startsWith("19%3ameeting_"),
    );
    if (meetingSegment) {
      const s = meetingSegment.split("19%3ameeting_")[1];
      if (!s) return null;
      meetingId = decodeURIComponent(s).split("@")[0] ?? null;
    }

    const params = new URLSearchParams(urlObj.search);
    const context = params.get("context");

    let tenantId: string | null = null;
    let organizationId: string | null = null;
    if (context) {
      const contextObj = JSON.parse(decodeURIComponent(context)) as Record<
        string,
        string
      >;
      tenantId = contextObj.Tid ?? null;
      organizationId = contextObj.Oid ?? null;
    }

    if (meetingId === null || tenantId === null || organizationId === null) {
      return null;
    }

    return { meetingId, tenantId, organizationId };
  } catch {
    return null;
  }
}

export function checkTeamsBotLink(link: string): boolean {
  return parseTeamsMeetingLink(link) !== null;
}

export function detectPlatform(link: string): MeetingPlatform | undefined {
  if (!link) return undefined;
  if (checkMeetBotLink(link)) return "google";
  if (checkZoomBotLink(link)) return "zoom";
  if (checkTeamsBotLink(link)) return "teams";
  return undefined;
}

function parseZoomMeetingLink(
  url: string,
): { meetingId: string; meetingPassword: string } | null {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split("/");
    const meetingId = pathSegments[pathSegments.length - 1] ?? "";
    const meetingPassword = urlObj.searchParams.get("pwd") ?? "";
    return { meetingId, meetingPassword };
  } catch {
    return null;
  }
}

export function defineMeetingInfo(
  link: string,
  type: MeetingPlatform | undefined,
): MeetingInfo | undefined {
  if (!type) return undefined;

  if (type === "google") {
    let url = link;
    if (!url.startsWith("https://meet.google.com/"))
      url = "https://meet.google.com/" + url;
    if (!url.startsWith("https://")) url = "https://" + url;
    return { platform: "google", meetingUrl: url };
  }

  if (type === "zoom") {
    const parsed = parseZoomMeetingLink(link);
    if (!parsed) return undefined;
    return {
      platform: "zoom",
      meetingId: parsed.meetingId,
      meetingPassword: parsed.meetingPassword,
    };
  }

  if (type === "teams") {
    const parsed = parseTeamsMeetingLink(link);
    if (!parsed) return undefined;
    return {
      platform: "teams",
      meetingId: parsed.meetingId,
      organizerId: parsed.organizationId,
      tenantId: parsed.tenantId,
    };
  }

  return undefined;
}
