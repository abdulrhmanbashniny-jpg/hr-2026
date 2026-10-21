import { describe, expect, it } from 'vitest';
import { BlockedDestinationError, checkSmtpDestination, checkWebhookUrl, isPublicAddress, resolvePublicHost } from '@/lib/net/outbound';

describe('outbound destination policy', () => {
  it('blocks loopback, private, link-local, CGNAT and reserved IPv4', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '142.250.74.46']) expect(isPublicAddress(ip), ip).toBe(true);
  });

  it('blocks private IPv6 including IPv4-mapped and NAT64 forms of private addresses', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::a9fe:a9fe', '2001:db8::1']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ['2606:4700:4700::1111', '::ffff:8.8.8.8']) expect(isPublicAddress(ip), ip).toBe(true);
  });

  it('rejects local names, literal private addresses, odd ports and non-https webhooks', async () => {
    await expect(resolvePublicHost('localhost')).rejects.toBeInstanceOf(BlockedDestinationError);
    await expect(resolvePublicHost('[::1]')).rejects.toBeInstanceOf(BlockedDestinationError);
    await expect(checkSmtpDestination('127.0.0.1', 587)).rejects.toBeInstanceOf(BlockedDestinationError);
    await expect(checkSmtpDestination('8.8.8.8', 6379)).rejects.toMatchObject({ reason: 'port' });
    await expect(checkWebhookUrl('http://example.com/hook')).rejects.toMatchObject({ reason: 'invalid' });
    await expect(checkWebhookUrl('https://user:pw@example.com/hook')).rejects.toMatchObject({ reason: 'invalid' });
    await expect(checkWebhookUrl('https://169.254.169.254/latest/meta-data')).rejects.toMatchObject({ reason: 'private' });
    await expect(checkWebhookUrl('https://[::ffff:127.0.0.1]/x')).rejects.toMatchObject({ reason: 'private' });
  });
});
