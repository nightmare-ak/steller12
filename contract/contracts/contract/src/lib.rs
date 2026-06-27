#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec};

#[contracttype]
pub enum DataKey {
    Admin,
    RewardToken,
    Leaderboard,
    Score(Address),
    TotalPlayers,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Entry {
    pub player: Address,
    pub score: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PlayerStats {
    pub score: u64,
    pub rank: u32,
    pub total_players: u32,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn init(env: Env, admin: Address, reward_token: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RewardToken, &reward_token);
        env.storage().instance().set(&DataKey::Leaderboard, &Vec::<Entry>::new(&env));
        env.storage().instance().set(&DataKey::TotalPlayers, &0u32);
    }

    pub fn submit_score(env: Env, player: Address, score: u64) {
        player.require_auth();

        let best: u64 = env.storage()
            .persistent()
            .get(&DataKey::Score(player.clone()))
            .unwrap_or(0);
        if score <= best {
            return;
        }

        // Detect new players before overwriting
        let is_new = !env.storage()
            .persistent()
            .has(&DataKey::Score(player.clone()));

        env.storage()
            .persistent()
            .set(&DataKey::Score(player.clone()), &score);

        // Rebuild leaderboard sorted descending
        let old_lb: Vec<Entry> = env.storage().instance()
            .get(&DataKey::Leaderboard)
            .unwrap_or(Vec::new(&env));
        let mut new_lb = Vec::<Entry>::new(&env);
        let mut inserted = false;
        let mut i: u32 = 0;

        while i < old_lb.len() {
            let e = old_lb.get(i).unwrap();
            if e.player != player {
                if !inserted && score > e.score {
                    new_lb.push_back(Entry { player: player.clone(), score });
                    inserted = true;
                }
                new_lb.push_back(e);
            }
            i += 1;
        }
        if !inserted {
            new_lb.push_back(Entry { player, score });
        }

        env.storage().instance().set(&DataKey::Leaderboard, &new_lb);

        // Track unique player count
        if is_new {
            let total: u32 = env.storage().instance().get(&DataKey::TotalPlayers).unwrap_or(0);
            env.storage().instance().set(&DataKey::TotalPlayers, &(total + 1));
        }
    }

    pub fn get_score(env: Env, player: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::Score(player))
            .unwrap_or(0)
    }

    pub fn get_leaderboard(env: Env, top_n: u32) -> Vec<Entry> {
        let lb: Vec<Entry> = env.storage().instance()
            .get(&DataKey::Leaderboard)
            .unwrap_or(Vec::new(&env));
        let mut result = Vec::<Entry>::new(&env);
        let count = if top_n < lb.len() { top_n } else { lb.len() };
        let mut i: u32 = 0;
        while i < count {
            result.push_back(lb.get(i).unwrap());
            i += 1;
        }
        result
    }

    /// Total number of unique players who have ever submitted a score.
    pub fn get_total_players(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::TotalPlayers).unwrap_or(0)
    }

    /// Rank (1-based) of a player on the leaderboard. Returns 0 if not found.
    pub fn get_rank(env: Env, player: Address) -> u32 {
        let lb: Vec<Entry> = env.storage().instance()
            .get(&DataKey::Leaderboard)
            .unwrap_or(Vec::new(&env));
        let mut i: u32 = 0;
        while i < lb.len() {
            if lb.get(i).unwrap().player == player {
                return i + 1;
            }
            i += 1;
        }
        0
    }

    /// Convenience: score, rank, and total players in one read.
    pub fn get_player_stats(env: Env, player: Address) -> PlayerStats {
        let score = Self::get_score(env.clone(), player.clone());
        let rank = Self::get_rank(env.clone(), player.clone());
        let total_players = Self::get_total_players(env.clone());
        PlayerStats { score, rank, total_players }
    }

    /// Permissionless — any player in the top N can claim a token reward.
    pub fn claim_reward(env: Env, player: Address, top_n: u32, amount: i128) {
        player.require_auth();
        let rank = Self::get_rank(env.clone(), player.clone());
        if rank == 0 || rank > top_n {
            panic!("not in top N");
        }
        let reward_token: Address = env.storage().instance().get(&DataKey::RewardToken).unwrap();
        token::Client::new(&env, &reward_token)
            .transfer(&env.current_contract_address(), &player, &amount);
    }

    /// Admin-only: reward every player in the top N.
    pub fn reward_top_players(env: Env, admin: Address, top_n: u32, amount: i128) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("unauthorized");
        }

        let reward_token: Address = env.storage().instance().get(&DataKey::RewardToken).unwrap();
        let lb: Vec<Entry> = env.storage().instance().get(&DataKey::Leaderboard).unwrap();
        let count = if top_n < lb.len() { top_n } else { lb.len() };
        let mut i: u32 = 0;
        while i < count {
            let entry = lb.get(i).unwrap();
            token::Client::new(&env, &reward_token)
                .transfer(&env.current_contract_address(), &entry.player, &amount);
            i += 1;
        }
    }

    pub fn get_reward_token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::RewardToken).unwrap()
    }
}

mod test;
