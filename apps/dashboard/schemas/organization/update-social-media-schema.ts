import { z } from 'zod';

const createSocialMediaField = (name: string) => {
  return z.url(`Enter a valid ${name} URL.`)
      .trim()
    .max(2000, `Maximum 2000 characters allowed.`)
    .optional()
    .or(z.literal(''));
};

export const updateSocialMediaSchema = z.object({
  linkedInProfile: createSocialMediaField('LinkedIn'),
  instagramProfile: createSocialMediaField('Instagram'),
  youTubeChannel: createSocialMediaField('YouTube'),
  xProfile: createSocialMediaField('X (Twitter)'),
  tikTokProfile: createSocialMediaField('TikTok'),
  facebookPage: createSocialMediaField('Facebook')
});

export type UpdateSocialMediaSchema = z.infer<typeof updateSocialMediaSchema>;
