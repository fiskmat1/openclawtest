import { ImageResponse } from 'next/og';

import { OgImage } from '@workspace/ui/components/og-image';

export async function GET() {
  return new ImageResponse(<OgImage />, {
    width: 1200,
    height: 630
  });
}
