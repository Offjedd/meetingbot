import { uploadRecordingToS3 } from '../src/s3';
import { jest, it, expect, describe } from '@jest/globals';
import fs from 'fs';
import { BotConfig } from '../src/types';
import { Bot } from '../src/bot';

jest.mock('fs');

describe('Local Recording Save Tests', () => {
  it("save a recording file to local disk", async () => {
    const mockConfig = {
      meetingInfo: {
        platform: 'google',
      },
    } as unknown as BotConfig;

    const someBot = new Bot(mockConfig, async () => {});
    someBot.getRecordingPath = jest.fn(() => '/tmp/mock-recording.mp4');
    someBot.getContentType = jest.fn(() => 'video/mp4');

    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('mock-video-data'));
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const result = await uploadRecordingToS3(null, someBot);

    expect(result).toBeTruthy();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
