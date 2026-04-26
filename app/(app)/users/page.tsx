"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { UsersManagement } from "@/components/users/users-management";

export default function UsersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members, roles, and daily goals."
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <UserPlus className="size-4" aria-hidden />
            New user
          </Button>
        }
      />
      <UsersManagement
        createControl={{ open: createOpen, setOpen: setCreateOpen }}
      />
    </div>
  );
}
