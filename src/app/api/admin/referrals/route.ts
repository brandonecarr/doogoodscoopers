/**
 * Admin Referrals API
 *
 * Manage referrals and referral program settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest, errorResponse } from "@/lib/api-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

const ALLOWED_ROLES = ["OWNER", "MANAGER", "OFFICE", "ACCOUNTANT"];

/**
 * GET /api/admin/referrals
 * List all referrals with stats
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  try {
    // Get program settings
    const { data: settings } = await supabase
      .from("referral_program_settings")
      .select("*")
      .eq("org_id", auth.user.orgId)
      .single();

    // Get referrals
    let query = supabase
      .from("referrals")
      .select(`
        id,
        referrer_client_id,
        referrer_name,
        referrer_email,
        referrer_phone,
        referee_name,
        referee_email,
        referee_phone,
        referral_code,
        status,
        converted_client_id,
        notes,
        created_at,
        updated_at
      `)
      .eq("org_id", auth.user.orgId)
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        `referrer_name.ilike.%${search}%,referrer_email.ilike.%${search}%,referee_name.ilike.%${search}%,referee_email.ilike.%${search}%,referral_code.ilike.%${search}%`
      );
    }

    const { data: referrals, error } = await query.limit(100);

    if (error) {
      console.error("Error fetching referrals:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    // Get referrer client names for those with client IDs
    const referrerClientIds = [...new Set((referrals || [])
      .filter(r => r.referrer_client_id)
      .map(r => r.referrer_client_id))];

    let clientNames: Record<string, string> = {};
    if (referrerClientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .in("id", referrerClientIds);

      for (const c of clients || []) {
        clientNames[c.id] = `${c.first_name} ${c.last_name}`;
      }
    }

    // Get rewards
    const referralIds = (referrals || []).map(r => r.id);
    let rewardsByReferral: Record<string, { referrer: number; referee: number }> = {};

    if (referralIds.length > 0) {
      const { data: rewards } = await supabase
        .from("referral_rewards")
        .select("referral_id, client_id, amount_cents")
        .in("referral_id", referralIds);

      for (const r of rewards || []) {
        if (!rewardsByReferral[r.referral_id]) {
          rewardsByReferral[r.referral_id] = { referrer: 0, referee: 0 };
        }
        // Determine if referrer or referee based on client_id match
        const referral = referrals?.find(ref => ref.id === r.referral_id);
        if (referral && r.client_id === referral.referrer_client_id) {
          rewardsByReferral[r.referral_id].referrer = r.amount_cents;
        } else {
          rewardsByReferral[r.referral_id].referee = r.amount_cents;
        }
      }
    }

    // Calculate stats
    const stats = {
      total: referrals?.length || 0,
      signedUp: referrals?.filter(r => r.status === "SIGNED_UP").length || 0,
      rewarded: referrals?.filter(r => r.status === "REWARDED").length || 0,
      pending: referrals?.filter(r => r.status === "NEW" || r.status === "INVITED").length || 0,
      closed: referrals?.filter(r => r.status === "CLOSED").length || 0,
      totalRewardsIssued: Object.values(rewardsByReferral).reduce(
        (sum, r) => sum + r.referrer + r.referee, 0
      ),
    };

    return NextResponse.json({
      settings: settings ? {
        isEnabled: settings.is_enabled,
        rewardReferrerCents: settings.reward_referrer_cents,
        rewardRefereeCents: settings.reward_referee_cents,
        rewardType: settings.reward_type,
        terms: settings.terms,
      } : null,
      referrals: (referrals || []).map(r => ({
        id: r.id,
        referrerClientId: r.referrer_client_id,
        referrerName: r.referrer_name || clientNames[r.referrer_client_id] || "Unknown",
        referrerEmail: r.referrer_email,
        referrerPhone: r.referrer_phone,
        refereeName: r.referee_name,
        refereeEmail: r.referee_email,
        refereePhone: r.referee_phone,
        referralCode: r.referral_code,
        status: r.status,
        convertedClientId: r.converted_client_id,
        notes: r.notes,
        rewards: rewardsByReferral[r.id] || { referrer: 0, referee: 0 },
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      stats: {
        ...stats,
        totalRewardsIssued: stats.totalRewardsIssued / 100,
      },
    });
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * POST /api/admin/referrals
 * Create a referral manually or update program settings
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "updateSettings") {
      const {
        isEnabled,
        rewardReferrerCents,
        rewardRefereeCents,
        rewardType,
        terms,
      } = body;

      // Upsert settings
      const { error: upsertError } = await supabase
        .from("referral_program_settings")
        .upsert({
          org_id: auth.user.orgId,
          is_enabled: isEnabled ?? true,
          reward_referrer_cents: rewardReferrerCents ?? 2500, // $25 default
          reward_referee_cents: rewardRefereeCents ?? 1000, // $10 default
          reward_type: rewardType || "ACCOUNT_CREDIT",
          terms: terms || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "org_id",
        });

      if (upsertError) {
        console.error("Error updating settings:", upsertError);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Settings updated" });
    }

    // Create manual referral
    const { referrerClientId, refereeName, refereeEmail, refereePhone } = body;

    if (!refereeName || !refereeEmail) {
      return NextResponse.json(
        { error: "Referee name and email required" },
        { status: 400 }
      );
    }

    // Get referrer info if client ID provided
    let referrerName = "Admin";
    let referrerEmail = auth.user.email;
    let referralCode = "ADMIN";

    if (referrerClientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("first_name, last_name, email, referral_code")
        .eq("id", referrerClientId)
        .eq("org_id", auth.user.orgId)
        .single();

      if (client) {
        referrerName = `${client.first_name} ${client.last_name}`;
        referrerEmail = client.email;
        referralCode = client.referral_code || referrerClientId.slice(0, 8).toUpperCase();
      }
    }

    const { data: referral, error: insertError } = await supabase
      .from("referrals")
      .insert({
        org_id: auth.user.orgId,
        referrer_client_id: referrerClientId || null,
        referrer_name: referrerName,
        referrer_email: referrerEmail,
        referee_name: refereeName,
        referee_email: refereeEmail,
        referee_phone: refereePhone || null,
        referral_code: referralCode,
        status: "INVITED",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating referral:", insertError);
      return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }

    return NextResponse.json(
      {
        referral: {
          id: referral.id,
          refereeName: referral.referee_name,
          refereeEmail: referral.referee_email,
          status: referral.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in referrals POST:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/referrals
 * Update referral status or issue rewards manually
 */
export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    // Get referral
    const { data: referral } = await supabase
      .from("referrals")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.user.orgId)
      .single();

    if (!referral) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "issueRewards") {
      // Get program settings
      const { data: settings } = await supabase
        .from("referral_program_settings")
        .select("*")
        .eq("org_id", auth.user.orgId)
        .single();

      if (!settings) {
        return NextResponse.json(
          { error: "Referral program not configured" },
          { status: 400 }
        );
      }

      // Issue referrer reward if they have a client account
      if (referral.referrer_client_id && settings.reward_referrer_cents > 0) {
        await supabase.from("referral_rewards").insert({
          org_id: auth.user.orgId,
          referral_id: referral.id,
          client_id: referral.referrer_client_id,
          amount_cents: settings.reward_referrer_cents,
          reward_type: settings.reward_type,
          issued_at: new Date().toISOString(),
        });

        // Add account credit
        if (settings.reward_type === "ACCOUNT_CREDIT") {
          await supabase.from("account_credits").insert({
            org_id: auth.user.orgId,
            client_id: referral.referrer_client_id,
            amount_cents: settings.reward_referrer_cents,
            balance_cents: settings.reward_referrer_cents,
            source: "REFERRAL",
            reference_id: referral.id,
          });
        }
      }

      // Issue referee reward if they have a client account
      if (referral.converted_client_id && settings.reward_referee_cents > 0) {
        await supabase.from("referral_rewards").insert({
          org_id: auth.user.orgId,
          referral_id: referral.id,
          client_id: referral.converted_client_id,
          amount_cents: settings.reward_referee_cents,
          reward_type: settings.reward_type,
          issued_at: new Date().toISOString(),
        });

        // Add account credit
        if (settings.reward_type === "ACCOUNT_CREDIT") {
          await supabase.from("account_credits").insert({
            org_id: auth.user.orgId,
            client_id: referral.converted_client_id,
            amount_cents: settings.reward_referee_cents,
            balance_cents: settings.reward_referee_cents,
            source: "REFERRAL",
            reference_id: referral.id,
          });
        }
      }

      // Update referral status
      await supabase
        .from("referrals")
        .update({
          status: "REWARDED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json({ success: true, message: "Rewards issued" });
    }

    if (action === "close") {
      await supabase
        .from("referrals")
        .update({
          status: "CLOSED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json({ success: true, message: "Referral closed" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating referral:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
