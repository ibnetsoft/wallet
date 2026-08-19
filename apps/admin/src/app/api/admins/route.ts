import { NextResponse } from "next/server";
import { getAdminPermissions, getAdminRole, isConfiguredAdminEmail, normalizeEmail } from "@/lib/admin-access";
import { getAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function requireSuperAdmin(email: string) {
  return isConfiguredAdminEmail(email);
}

function mapPermissionLabels(permissions: string[]) {
  return permissions.map((permission) => {
    switch (permission) {
      case "withdraw.manage":
        return "출금 승인";
      case "wallet.manage":
        return "지갑 관리";
      case "member.read":
      default:
        return "회원 조회";
    }
  });
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const subAdmins = data.users
    .filter((user) => user.app_metadata?.adminConsole === true && !isConfiguredAdminEmail(user.email))
    .map((user) => {
      const permissions = getAdminPermissions(user.app_metadata);
      return {
        id: user.id,
        email: normalizeEmail(user.email),
        role: getAdminRole(user),
        permissions: mapPermissionLabels(permissions),
        createdAt: user.created_at ? new Date(user.created_at).toISOString().split("T")[0] : "",
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  return NextResponse.json({ success: true, subAdmins });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!requireSuperAdmin(admin.email)) {
    return NextResponse.json({ success: false, error: "Only super admins can create admin accounts." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
  const password = typeof body?.password === "string" ? body.password : "";
  const requestedPermissions = Array.isArray(body?.permissions)
    ? body.permissions.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (!email) {
    return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (isConfiguredAdminEmail(email)) {
    return NextResponse.json({ success: false, error: "This email is already configured as a super admin." }, { status: 400 });
  }

  const permissions = ["member.read", ...requestedPermissions.filter((value) => value !== "member.read")];
  const uniquePermissions = [...new Set(permissions)];

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      adminConsole: true,
      adminRole: "SUB_ADMIN",
      adminPermissions: uniquePermissions,
    },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { success: false, error: error?.message ?? "Failed to create sub admin." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    subAdmin: {
      id: data.user.id,
      email,
      role: "SUB_ADMIN",
      permissions: mapPermissionLabels(uniquePermissions),
      createdAt: data.user.created_at ? new Date(data.user.created_at).toISOString().split("T")[0] : "",
    },
  });
}

export async function DELETE(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!requireSuperAdmin(admin.email)) {
    return NextResponse.json({ success: false, error: "Only super admins can delete admin accounts." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";

  if (!id) {
    return NextResponse.json({ success: false, error: "Admin id is required." }, { status: 400 });
  }

  const existing = await supabaseAdmin.auth.admin.getUserById(id);
  if (existing.error || !existing.data.user) {
    return NextResponse.json({ success: false, error: "Admin account not found." }, { status: 404 });
  }
  if (isConfiguredAdminEmail(existing.data.user.email)) {
    return NextResponse.json({ success: false, error: "Super admin accounts cannot be deleted here." }, { status: 400 });
  }

  const result = await supabaseAdmin.auth.admin.deleteUser(id);
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
