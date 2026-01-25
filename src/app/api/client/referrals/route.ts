/**
 * Client Referrals API
 *
 * Get referral program info, submit referrals, and track rewards.
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

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client access required" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    // Get client
    const { data: client } = await supabase
      .from("clients")
      .select("id, referral_code, account_credit_cents, org_id")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get referral program settings
    const { data: settings } = await supabase
      .from("referral_program_settings")
      .select("*")
      .eq("org_id", client.org_id)
      .single();

    // Get referrals made by this client
    const { data: referrals } = await supabase
      .from("referrals")
      .select(`
        id,
        referee_name,
        referee_email,
        referee_phone,
        status,
        created_at,
        converted_at,
        referee_client:referee_client_id (
          first_name,
          last_name
        )
      `)
      .eq("referrer_client_id", client.id)
      .order("created_at", { ascending: false });

    // Get rewards earned
    const { data: rewards } = await supabase
      .from("referral_rewards")
      .select(`
        id,
        amount_cents,
        status,
        created_at,
        applied_at,
        referral:referral_id (
          referee_name
        )
      `)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    // Calculate totals
    const stats = {
      totalReferrals: referrals?.length || 0,
      converted: referrals?.filter((r) => r.status === "CONVERTED").length || 0,
      pending: referrals?.filter((r) => r.status === "PENDING").length || 0,
      totalEarned: rewards?.reduce((sum, r) => sum + r.amount_cents, 0) || 0,
      availableCredit: client.account_credit_cents || 0,
    };

    // Generate referral link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://doogoodscoopers.com";
    const referralLink = `${baseUrl}/quote?ref=${client.referral_code}`;

    return NextResponse.json({
      referralCode: client.referral_code,
      referralLink,
      program: settings
        ? {
            isEnabled: settings.is_enabled,
            referrerReward: settings.reward_referrer_cents,
            refereeReward: settings.reward_referee_cents,
            rewardType: settings.reward_type,
            terms: settings.terms,
          }
        : null,
      stats,
      referrals: (referrals || []).map((ref) => ({
        id: ref.id,
        refereeName: ref.referee_name,
        refereeEmail: ref.referee_email,
        refereePhone: ref.referee_phone,
        status: ref.status,
        createdAt: ref.created_at,
        convertedAt: ref.converted_at,
      })),
      rewards: (rewards || []).map((reward) => ({
        id: reward.id,
        amountCents: reward.amount_cents,
        status: reward.status,
        createdAt: reward.created_at,
        appliedAt: reward.applied_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        refereeName: (reward.referral as any)?.referee_name,
      })),
    });
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return NextResponse.json({ error: "Failed to fetch referrals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  if (auth.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client access required" }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { name, email, phone } = body;

    if (!name || (!email && !phone)) {
      return NextResponse.json(
        { error: "Name and either email or phone required" },
        { status: 400 }
      );
    }

    // Get client
    const { data: client } = await supabase
      .from("clients")
      .select("id, org_id, referral_code")
      .eq("user_id", auth.user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check if referral already exists
    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referrer_client_id", client.id)
      .or(`referee_email.eq.${email},referee_phone.eq.${phone}`)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "You have already referred this person" },
        { status: 400 }
      );
    }

    // Create referral
    const { data: referral, error: createError } = await supabase
      .from("referrals")
      .insert({
        org_id: client.org_id,
        referrer_client_id: client.id,
        referral_code: client.referral_code,
        referee_name: name,
        referee_email: email || null,
        referee_phone: phone || null,
        status: "PENDING",
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating referral:", createError);
      return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      referral: {
        id: referral.id,
        refereeName: referral.referee_name,
        status: referral.status,
      },
      message: "Referral submitted successfully!",
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating referral:", error);
    return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
  }
}
