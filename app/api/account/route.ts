import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Permanently deletes the signed-in student's account.
 *
 * Removing the auth user cascades through profiles -> exam_attempts ->
 * exam_answers, plus study sessions and technique selections, so a single
 * delete clears every record we hold for them.
 *
 * Staff are refused: uploads.uploaded_by and review_materials.uploaded_by are
 * ON DELETE RESTRICT, so deleting an admin who has imported anything raises a
 * foreign key violation. Reassigning that content is an operations task.
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? user.user_metadata?.role ?? "student";

    if (role !== "student") {
      return NextResponse.json(
        {
          error:
            "Admin and instructor accounts cannot be deleted from here because they own imported content. Please contact support."
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete your account." },
      { status: 500 }
    );
  }
}
