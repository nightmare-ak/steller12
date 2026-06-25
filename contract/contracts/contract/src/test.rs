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
