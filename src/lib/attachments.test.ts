// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readAttachments, packMessage, unpackMessage, displayMessage } from './attachments';
describe('composer attachments', () => {
  it('reads image, PDF and text uploads and retains their bytes through edit and retry', async () => {
    const files = await readAttachments([
      new File(['image bytes'], 'screen.png', { type: 'image/png' }),
      new File(['%PDF-1.7'], 'report.pdf', { type: 'application/pdf' }),
      new File(['notes'], 'notes.txt', { type: 'text/plain' }),
    ]);
    expect(atob(files[1].data)).toBe('%PDF-1.7');
    const message = packMessage('Review these', files);
    expect(unpackMessage(message.trim()).attachments).toEqual(files);
    expect(
      unpackMessage(packMessage('Edited', unpackMessage(message).attachments)).text.trim(),
    ).toBe('Edited');
    expect(displayMessage(message)).toContain('report.pdf');
    expect(displayMessage(message)).not.toContain(files[1].data);
  });
  it('allows a clipboard image to be sent without accompanying text', async () => {
    const files = await readAttachments([
      new File(['pixels'], 'clipboard.png', { type: 'image/png' }),
    ]);
    expect(unpackMessage(packMessage('', files).trim()).attachments).toEqual(files);
  });
  it('rejects files larger than the upload limit before reading', async () => {
    await expect(
      readAttachments([new File([new Uint8Array(21 * 1024 * 1024)], 'huge.pdf')]),
    ).rejects.toThrow('20 MB');
  });
});
