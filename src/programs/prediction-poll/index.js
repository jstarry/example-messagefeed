/* @flow */
import {
  Account,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import type {TransactionSignature} from '@solana/web3.js';

import {Clock, Collection, InitPoll, Poll, Tally} from '../../../wasm';
import * as ProgramCommand from './command';

/**
 * Refreshes a poll collection
 */
export async function refreshCollection(
  connection: Connection,
  collection: PublicKey,
): Collection {
  console.log(`Loading collection ${collection.toString()}`);
  const accountInfo = await connection.getAccountInfo(collection);
  return Collection.fromData(accountInfo.data);
}

/**
 * Refreshes the clock
 */
export async function refreshClock(connection: Connection): Clock {
  console.log(`Loading clock`);
  const clockKey = ProgramCommand.getSysvarClockPublicKey();
  const accountInfo = await connection.getAccountInfo(clockKey);
  return Clock.fromData(accountInfo.data);
}

/**
 * Fetches poll info
 */
export async function refreshPoll(
  connection: Connection,
  pollKey: PublicKey,
): Poll {
  console.log(`Refreshing poll ${pollKey.toString()}`);
  const accountInfo = await connection.getAccountInfo(pollKey);
  console.log('refreshed');
  const poll = Poll.fromData(accountInfo.data);
  const options = [poll.optionA, poll.optionB];
  for (const option of options) {
    const tallyKey = new PublicKey(option.tallyKey);
    const tallyInfo = await connection.getAccountInfo(tallyKey);
    const tally = Tally.fromData(tallyInfo.data);
    console.log({tally: tally.keys, quantity: option.quantity});
  }
  return poll;
}

/**
 * Creates a new poll with two options and a block timeout
 */
export async function createPoll(
  connection: Connection,
  programId: PublicKey,
  collection: PublicKey,
  payerAccount: Account,
  header: string,
  optionA: string,
  optionB: string,
  timeout: number,
): Promise<TransactionSignature> {
  const transaction = new Transaction();

  const pollAccount = new Account();
  transaction.add(
    SystemProgram.createAccount(
      payerAccount.publicKey,
      pollAccount.publicKey,
      1,
      500, // TODO calculate
      programId,
    ),
  );

  const tallyAccounts = [new Account(), new Account()];
  for (const tallyAccount of tallyAccounts) {
    transaction.add(
      SystemProgram.createAccount(
        payerAccount.publicKey,
        tallyAccount.publicKey,
        1,
        500, // TODO revisit
        programId,
      ),
    );
  }

  transaction.add({
    keys: [
      {pubkey: pollAccount.publicKey, isSigner: true, isDebitable: true},
      {pubkey: collection, isSigner: false, isDebitable: true},
      {pubkey: tallyAccounts[0].publicKey, isSigner: false, isDebitable: false},
      {pubkey: tallyAccounts[1].publicKey, isSigner: false, isDebitable: false},
      {
        pubkey: ProgramCommand.getSysvarClockPublicKey(),
        isSigner: false,
        isDebitable: false,
      },
    ],
    programId,
    data: ProgramCommand.initPoll(
      new InitPoll(header, optionA, optionB, timeout),
    ),
  });

  return await sendAndConfirmTransaction(
    connection,
    transaction,
    payerAccount,
    pollAccount,
  );
}

/**
 * Submit a vote to a poll
 */
export async function vote(
  connection: Connection,
  programId: PublicKey,
  payerAccount: Account,
  poll: PublicKey,
  wager: number,
  tally: PublicKey,
): Promise<TransactionSignature> {
  const transaction = new Transaction();

  const userAccount = new Account();
  transaction.add(
    SystemProgram.createAccount(
      payerAccount.publicKey,
      userAccount.publicKey,
      wager,
      1, // TODO check if 0 is ok
      programId,
    ),
  );

  transaction.add({
    keys: [
      {pubkey: userAccount.publicKey, isSigner: true, isDebitable: true},
      {pubkey: poll, isSigner: false, isDebitable: true},
      {pubkey: tally, isSigner: false, isDebitable: true},
      {pubkey: payerAccount.publicKey, isSigner: false, isDebitable: false},
      {
        pubkey: ProgramCommand.getSysvarClockPublicKey(),
        isSigner: false,
        isDebitable: false,
      },
    ],
    programId,
    data: ProgramCommand.submitVote(),
  });

  return await sendAndConfirmTransaction(
    connection,
    transaction,
    payerAccount,
    userAccount,
  );
}

/**
 * Submit a claim to an expired poll
 */
export async function claim(
  connection: Connection,
  programId: PublicKey,
  payerAccount: Account,
  pollKey: PublicKey,
  poll: Poll,
): Promise<TransactionSignature> {
  const tallyKey =
    poll.optionA.quantity > poll.optionB.quantity
      ? new PublicKey(poll.optionA.tallyKey)
      : new PublicKey(poll.optionB.tallyKey);

  const clockKey = ProgramCommand.getSysvarClockPublicKey();
  const tallyAccount = await connection.getAccountInfo(tallyKey);
  const tally = Tally.fromData(tallyAccount.data);

  const transaction = new Transaction();
  const payoutKeys = tally.keys.map(k => {
    const pubkey = new PublicKey(k);
    return {pubkey, isSigner: false, isDebitable: false};
  });

  transaction.add({
    keys: [
      {pubkey: pollKey, isSigner: false, isDebitable: true},
      {pubkey: tallyKey, isSigner: false, isDebitable: false},
      {pubkey: clockKey, isSigner: false, isDebitable: false},
      ...payoutKeys,
    ],
    programId,
    data: ProgramCommand.submitClaim(),
  });

  return await sendAndConfirmTransaction(connection, transaction, payerAccount);
}
