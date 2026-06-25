import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128 } from "@stellar/stellar-sdk/contract";

export interface Entry {
  player: string;
  score: u64;
}

export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CABX5FTHFQ3AKJP575FRJRGSCO4J5Y3QOL5HF7OTY3YPMJ65AAFKUOT6",
  },
} as const;

export interface Client {
  init: (
    { admin, reward_token }: { admin: string; reward_token: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  get_score: (
    { player }: { player: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<u64>>;

  submit_score: (
    { player, score }: { player: string; score: u64 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  get_leaderboard: (
    { top_n }: { top_n: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Array<Entry>>>;

  get_reward_token: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<string>>;

  reward_top_players: (
    { admin, top_n, amount }: { admin: string; top_n: u32; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;
}

export class Client extends ContractClient {
  declare readonly options: ContractClientOptions;

  constructor(options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAQAAAAAAAAAAAAAABUVudHJ5AAAAAAAAAgAAAAAAAAAGcGxheWVyAAAAAAATAAAAAAAAAAVzY29yZQAAAAAAAAY=",
        "AAAAAAAAAAAAAAAEaW5pdAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAMcmV3YXJkX3Rva2VuAAAAEwAAAAA=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAALUmV3YXJkVG9rZW4AAAAAAAAAAAAAAAALTGVhZGVyYm9hcmQAAAAAAQAAAAAAAAAFU2NvcmUAAAAAAAABAAAAEw==",
        "AAAAAAAAAAAAAAAJZ2V0X3Njb3JlAAAAAAAAAQAAAAAAAAAGcGxheWVyAAAAAAATAAAAAQAAAAY=",
        "AAAAAAAAAAAAAAAMc3VibWl0X3Njb3JlAAAAAgAAAAAAAAAGcGxheWVyAAAAAAATAAAAAAAAAAVzY29yZQAAAAAAAAYAAAAA",
        "AAAAAAAAAAAAAAAPZ2V0X2xlYWRlcmJvYXJkAAAAAAEAAAAAAAAABXRvcF9uAAAAAAAABAAAAAEAAAPqAAAH0AAAAAVFbnRyeQAAAA==",
        "AAAAAAAAAAAAAAAQZ2V0X3Jld2FyZF90b2tlbgAAAAAAAAABAAAAEw==",
        "AAAAAAAAAAAAAAAScmV3YXJkX3RvcF9wbGF5ZXJzAAAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABXRvcF9uAAAAAAAABAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
      ]),
      options
    );
  }

  readonly fromJSON = {
    init: this.txFromJSON<null>,
    get_score: this.txFromJSON<u64>,
    submit_score: this.txFromJSON<null>,
    get_leaderboard: this.txFromJSON<Array<Entry>>,
    get_reward_token: this.txFromJSON<string>,
    reward_top_players: this.txFromJSON<null>,
  };
}
