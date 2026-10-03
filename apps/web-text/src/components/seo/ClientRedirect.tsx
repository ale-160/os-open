'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 客户端智能重定向组件
 *
 * 中文为主策略：访问默认英文路由（/）时默认跳转 /zh；
 * 仅当用户明确把语言切到英文时保留英文页面。
 *
 * 纯客户端组件，不渲染任何 HTML，不影响 SEO
 */
export default function ClientRedirect() {
  const router = useRouter();

  useEffect(() => {
    // 用户明确选择过英文时，尊重其选择留在根路由
    const savedLang = localStorage.getItem('web-text-language');
    if (savedLang === 'en') {
      return;
    }
    router.replace('/zh');
  }, [router]);

  return null;
}
