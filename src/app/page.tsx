import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export default function Home() {
  const token = cookies().get('ci_token')?.value;
  if (token && verifyToken(token)) redirect('/dashboard');
  redirect('/login');
}
