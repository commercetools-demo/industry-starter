'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Chip } from '@/components/portal/Chip';
import { cardClass, errorNote, sectionTitle, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { PermissionButton } from '@/components/portal/PermissionButton';
import { useCompanyUsers } from '@/hooks/companyApi';
import { InviteDialog } from './InviteDialog';

/** Users of the unit: name, email, role, status (Active or Invited), last active. Invite is Admin only (disabled for a Buyer). */
export function UsersTab() {
  const t = useTranslations('company.users');
  const format = useFormatter();
  const { data, error, isLoading } = useCompanyUsers();
  const [inviting, setInviting] = useState(false);
  const users = data?.users ?? [];

  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="users-title">
      <div className="flex flex-wrap items-start justify-between gap-300">
        <div>
          <h2 id="users-title" className={sectionTitle}>
            {t('title')}
          </h2>
          <p className="text-body-2 text-text-subdued">{t('subtitle')}</p>
        </div>
        <PermissionButton action="company.edit" onClick={() => setInviting(true)}>
          {t('invite')}
        </PermissionButton>
      </div>
      {error ? (
        <p role="alert" className={errorNote}>
          {t('loadFailed')}
        </p>
      ) : null}
      {isLoading ? (
        <p role="status" className="text-body-2 text-text-subdued">
          {t('loading')}
        </p>
      ) : (
        <div className={tableScroll} role="group" tabIndex={0} aria-labelledby="users-title">
          <table className="w-full" aria-labelledby="users-title">
            <thead>
              <tr>
                <th scope="col" className={thClass}>{t('name')}</th>
                <th scope="col" className={thClass}>{t('email')}</th>
                <th scope="col" className={thClass}>{t('role')}</th>
                <th scope="col" className={thClass}>{t('status')}</th>
                <th scope="col" className={thClass}>{t('lastActive')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.customerId} className="border-t border-border-subdued">
                  <td className={tdClass}>{user.name}</td>
                  <td className={tdClass}>{user.email}</td>
                  <td className={tdClass}>{user.role}</td>
                  <td className={tdClass}>
                    <Chip tone={user.status === 'Active' ? 'success' : 'warning'}>{t(user.status === 'Active' ? 'active' : 'invited')}</Chip>
                  </td>
                  <td className={tdClass}>{user.lastActive ? format.dateTime(new Date(user.lastActive), { dateStyle: 'medium' }) : t('never')}</td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td className={tdClass} colSpan={5}>
                    {t('empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </section>
  );
}
