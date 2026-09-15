import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getSupabaseClient,
} from "@/lib/supabase";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0",
};

function response(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
      headers:
        NO_STORE_HEADERS,
    }
  );
}

const EMAIL_CHANGES = [
  {
    oldEmail:
      "agentdev@royalpartner.org",

    newEmail:
      "newagent@royalpartner.org",
  },
  {
    oldEmail:
      "ea@royalpartner.org",

    newEmail:
      "executive@royalpartner.org",
  },
] as const;

export async function POST() {
  try {
    /*
      ตรวจสอบผู้ใช้งานที่กำลัง Login
    */

    const userClient =
      createClient();

    const {
      data: { user },
      error: userError,
    } =
      await userClient.auth.getUser();

    if (userError || !user) {
      return response(
        {
          error:
            "กรุณาเข้าสู่ระบบก่อน",
        },
        401
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await userClient
      .from("user_profiles")
      .select("role, active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.active !== true ||
      profile.role !== "admin"
    ) {
      return response(
        {
          error:
            "เฉพาะ Admin เท่านั้น",
        },
        403
      );
    }

    /*
      ใช้ Secret Key เฉพาะฝั่ง Server
    */

    const adminClient =
      getSupabaseClient();

    const {
      data: usersResult,
      error: listError,
    } =
      await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      console.error(
        "[rename-auth-emails] list users error:",
        listError
      );

      return response(
        {
          error:
            "ไม่สามารถโหลดบัญชีผู้ใช้ได้",
        },
        500
      );
    }

    const authUsers =
      usersResult.users ?? [];

    const results: Array<
      Record<string, unknown>
    > = [];

    for (
      const change of EMAIL_CHANGES
    ) {
      const oldEmail =
        change.oldEmail.toLowerCase();

      const newEmail =
        change.newEmail.toLowerCase();

      const oldUser =
        authUsers.find(
          (item) =>
            item.email
              ?.toLowerCase() ===
            oldEmail
        );

      const existingNewUser =
        authUsers.find(
          (item) =>
            item.email
              ?.toLowerCase() ===
            newEmail
        );

      /*
        หากเปลี่ยนไปแล้ว
        ให้อัปเดต user_profiles ให้ตรง
      */

      if (
        !oldUser &&
        existingNewUser
      ) {
        const {
          error: profileUpdateError,
        } = await adminClient
          .from("user_profiles")
          .update({
            email: newEmail,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "user_id",
            existingNewUser.id
          );

        if (profileUpdateError) {
          throw profileUpdateError;
        }

        results.push({
          oldEmail,
          newEmail,
          status:
            "already_updated",
          userId:
            existingNewUser.id,
        });

        continue;
      }

      if (!oldUser) {
        results.push({
          oldEmail,
          newEmail,
          status:
            "old_user_not_found",
        });

        continue;
      }

      if (
        existingNewUser &&
        existingNewUser.id !==
          oldUser.id
      ) {
        return response(
          {
            error:
              `มีบัญชี ${newEmail} อยู่แล้ว`,
          },
          409
        );
      }

      /*
        เปลี่ยนอีเมลใน Supabase Auth
        โดยใช้ User UID เดิม
      */

      const {
        data: updatedAuth,
        error: authUpdateError,
      } =
        await adminClient.auth.admin
          .updateUserById(
            oldUser.id,
            {
              email: newEmail,
            }
          );

      if (authUpdateError) {
        console.error(
          "[rename-auth-emails] auth update error:",
          authUpdateError
        );

        return response(
          {
            error:
              `เปลี่ยน ${oldEmail} ไม่สำเร็จ`,
          },
          500
        );
      }

      /*
        เปลี่ยนอีเมลใน user_profiles
      */

      const {
        error: profileUpdateError,
      } = await adminClient
        .from("user_profiles")
        .update({
          email: newEmail,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "user_id",
          oldUser.id
        );

      if (profileUpdateError) {
        console.error(
          "[rename-auth-emails] profile update error:",
          profileUpdateError
        );

        return response(
          {
            error:
              `เปลี่ยน Profile ของ ${newEmail} ไม่สำเร็จ`,
          },
          500
        );
      }

      results.push({
        oldEmail,
        newEmail,
        status: "updated",
        userId:
          updatedAuth.user.id,
      });
    }

    return response({
      success: true,
      results,
    });
  } catch (error) {
    console.error(
      "[rename-auth-emails] unexpected error:",
      error
    );

    return response(
      {
        error:
          "เกิดข้อผิดพลาดในการเปลี่ยนอีเมล",
      },
      500
    );
  }
}

export async function GET() {
  return response(
    {
      error:
        "Method not allowed",
    },
    405
  );
}
