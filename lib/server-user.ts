import { getChatGPTUser, type ChatGPTUser } from '@/app/chatgpt-auth';

export type SiteUser = ChatGPTUser & { isLocalPreview: boolean };

export async function getSiteUser(): Promise<SiteUser | null> {
  const user = await getChatGPTUser();
  if (user) return { ...user, isLocalPreview: false };

  if (process.env.NODE_ENV !== 'production') {
    return {
      userId: 'local-preview',
      email: 'preview@nexocasa.local',
      displayName: 'Gabriel',
      fullName: 'Gabriel',
      isLocalPreview: true,
    };
  }

  return null;
}
