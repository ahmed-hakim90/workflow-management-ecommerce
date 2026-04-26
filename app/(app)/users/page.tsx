"use client";

import { PageHeader } from "@/components/layout/page-header";
import { UsersManagement } from "@/components/users/users-management";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description="إدارة الفريق، الأدوار، والأهداف اليومية."
      />

      <UsersManagement />
    </div>
  );
}
