/** Prints a VAPID key pair for Web Push. Put them in NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
