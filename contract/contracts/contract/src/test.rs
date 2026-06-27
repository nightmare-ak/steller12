#![cfg(test)]

use super::*;
use soroban_sdk::{vec, Address, Env};
use soroban_sdk::testutils::Address as _;

fn setup() -> (Env, ContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    // Deploy a real Stellar Asset token contract for rewards
    let token = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = token.address();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    client.init(&admin, &token_addr);
    (env, client, admin, token_addr, contract_id)
}

#[test]
fn test_init_and_submit_score() {
    let (env, client, _admin, _token, _cid) = setup();
    let player = Address::generate(&env);

    assert_eq!(client.get_score(&player), 0);
    assert_eq!(client.get_leaderboard(&10), vec![&env]);

    client.submit_score(&player, &100);
    assert_eq!(client.get_score(&player), 100);

    let lb = client.get_leaderboard(&10);
    assert_eq!(lb.len(), 1);
    assert_eq!(lb.get(0).unwrap().player, player);
    assert_eq!(lb.get(0).unwrap().score, 100);
}

#[test]
fn test_submit_only_increases_score() {
    let (env, client, _admin, _token, _cid) = setup();
    let player = Address::generate(&env);

    client.submit_score(&player, &100);
    assert_eq!(client.get_score(&player), 100);

    // Lower score does NOT update
    client.submit_score(&player, &50);
    assert_eq!(client.get_score(&player), 100);

    // Higher score updates
    client.submit_score(&player, &200);
    assert_eq!(client.get_score(&player), 200);
}

#[test]
fn test_leaderboard_ordering() {
    let (_env, client, _admin, _token, _cid) = setup();
    let alice = Address::generate(&_env);
    let bob = Address::generate(&_env);
    let charlie = Address::generate(&_env);

    client.submit_score(&alice, &50);
    client.submit_score(&bob, &100);
    client.submit_score(&charlie, &75);

    let lb = client.get_leaderboard(&10);
    assert_eq!(lb.len(), 3);
    assert_eq!(lb.get(0).unwrap().player, bob);
    assert_eq!(lb.get(1).unwrap().player, charlie);
    assert_eq!(lb.get(2).unwrap().player, alice);
    assert_eq!(lb.get(0).unwrap().score, 100);
    assert_eq!(lb.get(1).unwrap().score, 75);
    assert_eq!(lb.get(2).unwrap().score, 50);
}

#[test]
fn test_leaderboard_top_n() {
    let (_env, client, _admin, _token, _cid) = setup();
    let alice = Address::generate(&_env);
    let bob = Address::generate(&_env);
    let charlie = Address::generate(&_env);

    client.submit_score(&alice, &50);
    client.submit_score(&bob, &100);
    client.submit_score(&charlie, &75);

    let top_2 = client.get_leaderboard(&2);
    assert_eq!(top_2.len(), 2);
    assert_eq!(top_2.get(0).unwrap().player, bob);
    assert_eq!(top_2.get(1).unwrap().player, charlie);
}

#[test]
fn test_score_update_reorders_leaderboard() {
    let (_env, client, _admin, _token, _cid) = setup();
    let alice = Address::generate(&_env);
    let bob = Address::generate(&_env);

    client.submit_score(&alice, &50);
    client.submit_score(&bob, &100);

    let lb = client.get_leaderboard(&10);
    assert_eq!(lb.get(0).unwrap().player, bob);
    assert_eq!(lb.get(1).unwrap().player, alice);

    client.submit_score(&alice, &150);

    let lb = client.get_leaderboard(&10);
    assert_eq!(lb.len(), 2);
    assert_eq!(lb.get(0).unwrap().player, alice);
    assert_eq!(lb.get(0).unwrap().score, 150);
    assert_eq!(lb.get(1).unwrap().player, bob);
    assert_eq!(lb.get(1).unwrap().score, 100);
}

#[test]
fn test_reward_top_players_basic() {
    let (env, client, admin, token_addr, contract_id) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.submit_score(&alice, &100);
    client.submit_score(&bob, &50);

    // Fund the contract with tokens so it can reward players
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);
    sac.mint(&contract_id, &1000i128);

    // Now reward should work — transfers tokens from contract to top players
    client.reward_top_players(&admin, &2, &100i128);

    // Check alice received 100 tokens
    let token_client = soroban_sdk::token::TokenClient::new(&env, &token_addr);
    assert_eq!(token_client.balance(&alice), 100i128);
    // Check bob received 100 tokens
    assert_eq!(token_client.balance(&bob), 100i128);
    // Contract should have 800 left (1000 - 100 - 100)
    assert_eq!(token_client.balance(&contract_id), 800i128);
}

#[test]
fn test_get_reward_token() {
    let (_env, client, _admin, token, _cid) = setup();
    assert_eq!(client.get_reward_token(), token);
}

#[test]
#[should_panic(expected = "unauthorized")]
fn test_unauthorized_reward() {
    let (_env, client, _admin, _token, _cid) = setup();
    let fake_admin = Address::generate(&_env);
    client.reward_top_players(&fake_admin, &1, &100i128);
}

#[test]
fn test_multiple_players_same_score() {
    let (_env, client, _admin, _token, _cid) = setup();
    let a = Address::generate(&_env);
    let b = Address::generate(&_env);
    let c = Address::generate(&_env);

    client.submit_score(&a, &100);
    client.submit_score(&b, &100);
    client.submit_score(&c, &100);

    let lb = client.get_leaderboard(&10);
    assert_eq!(lb.len(), 3);
    for i in 0..3 {
        assert_eq!(lb.get(i).unwrap().score, 100);
    }
}

#[test]
#[should_panic(expected = "balance is not sufficient")]
fn test_reward_higher_amount_than_balance() {
    let (env, client, admin, token_addr, _contract_id) = setup();
    let alice = Address::generate(&env);

    client.submit_score(&alice, &100);

    // Trying to reward more than contract balance should fail
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);
    sac.mint(&_contract_id, &50i128);
    client.reward_top_players(&admin, &1, &100i128);
}

#[test]
fn test_reward_with_zero_top_n() {
    let (_env, client, admin, _token, _cid) = setup();
    // Should not panic when top_n is 0
    client.reward_top_players(&admin, &0, &100i128);
}

#[test]
fn test_leaderboard_empty() {
    let (_env, client, _admin, _token, _cid) = setup();
    let lb = client.get_leaderboard(&10);
    assert_eq!(lb, vec![&_env]);
}

#[test]
fn test_submit_score_without_init() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let player = Address::generate(&env);

    // Should NOT panic even though init() was never called
    client.submit_score(&player, &100);
    assert_eq!(client.get_score(&player), 100);

    let lb = client.get_leaderboard(&10);
    assert_eq!(lb.len(), 1);
    assert_eq!(lb.get(0).unwrap().player, player);
    assert_eq!(lb.get(0).unwrap().score, 100);
}

#[test]
fn test_get_leaderboard_without_init() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    // Should return empty leaderboard without panicking
    let lb = client.get_leaderboard(&10);
    assert_eq!(lb, vec![&env]);
}

// ─── New function tests ─────────────────────────────────────

#[test]
fn test_get_total_players() {
    let (_env, client, _admin, _token, _cid) = setup();
    assert_eq!(client.get_total_players(), 0);

    let a = Address::generate(&_env);
    let b = Address::generate(&_env);

    client.submit_score(&a, &100);
    assert_eq!(client.get_total_players(), 1);

    client.submit_score(&b, &50);
    assert_eq!(client.get_total_players(), 2);

    // Same player submitting again does NOT increment
    client.submit_score(&a, &200);
    assert_eq!(client.get_total_players(), 2);
}

#[test]
fn test_get_total_players_without_init() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    // Should not panic
    assert_eq!(client.get_total_players(), 0);

    let a = Address::generate(&env);
    client.submit_score(&a, &50);
    assert_eq!(client.get_total_players(), 1);
}

#[test]
fn test_get_rank() {
    let (_env, client, _admin, _token, _cid) = setup();
    let alice = Address::generate(&_env);
    let bob = Address::generate(&_env);
    let charlie = Address::generate(&_env);

    // Unknown player rank is 0
    assert_eq!(client.get_rank(&alice), 0);

    client.submit_score(&alice, &50);
    client.submit_score(&bob, &100);
    client.submit_score(&charlie, &75);

    assert_eq!(client.get_rank(&bob), 1);
    assert_eq!(client.get_rank(&charlie), 2);
    assert_eq!(client.get_rank(&alice), 3);
}

#[test]
fn test_get_rank_after_update() {
    let (_env, client, _admin, _token, _cid) = setup();
    let alice = Address::generate(&_env);
    let bob = Address::generate(&_env);

    client.submit_score(&alice, &50);
    client.submit_score(&bob, &100);
    assert_eq!(client.get_rank(&alice), 2);

    // Alice jumps ahead
    client.submit_score(&alice, &150);
    assert_eq!(client.get_rank(&alice), 1);
    assert_eq!(client.get_rank(&bob), 2);
}

#[test]
fn test_get_player_stats() {
    let (_env, client, _admin, _token, _cid) = setup();
    let alice = Address::generate(&_env);
    let bob = Address::generate(&_env);

    client.submit_score(&alice, &100);
    client.submit_score(&bob, &50);

    let stats = client.get_player_stats(&alice);
    assert_eq!(stats.score, 100);
    assert_eq!(stats.rank, 1);
    assert_eq!(stats.total_players, 2);

    let stats = client.get_player_stats(&bob);
    assert_eq!(stats.score, 50);
    assert_eq!(stats.rank, 2);
    assert_eq!(stats.total_players, 2);
}

#[test]
fn test_get_player_stats_unknown() {
    let (_env, client, _admin, _token, _cid) = setup();
    let nobody = Address::generate(&_env);

    let stats = client.get_player_stats(&nobody);
    assert_eq!(stats.score, 0);
    assert_eq!(stats.rank, 0);
    assert_eq!(stats.total_players, 0);
}

#[test]
fn test_claim_reward() {
    let (env, client, _admin, token_addr, contract_id) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.submit_score(&alice, &100);
    client.submit_score(&bob, &50);

    // Fund the contract with tokens
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_addr);
    sac.mint(&contract_id, &500i128);

    // Alice (rank 1) claims reward for top 2
    client.claim_reward(&alice, &2, &100i128);

    let token_client = soroban_sdk::token::TokenClient::new(&env, &token_addr);
    assert_eq!(token_client.balance(&alice), 100i128);
    assert_eq!(token_client.balance(&contract_id), 400i128);
}

#[test]
#[should_panic(expected = "not in top N")]
fn test_claim_reward_not_in_top_n() {
    let (_env, client, _admin, _token, _cid) = setup();
    let alice = Address::generate(&_env);
    let bob = Address::generate(&_env);

    client.submit_score(&alice, &100);
    client.submit_score(&bob, &50);

    // Alice is rank 1, but tries to claim with top_n=0
    client.claim_reward(&alice, &0, &100i128);
}

#[test]
#[should_panic(expected = "not in top N")]
fn test_claim_reward_unknown_player() {
    let (_env, client, _admin, _token, _cid) = setup();
    let nobody = Address::generate(&_env);
    client.claim_reward(&nobody, &10, &100i128);
}

#[test]
fn test_claim_reward_no_init_reward_token() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let player = Address::generate(&env);

    // Player submits score but reward_token was never set
    // claim_reward should panic when trying to unwrap missing RewardToken
    client.submit_score(&player, &100);
    assert_eq!(client.get_rank(&player), 1);
}
