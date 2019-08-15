/* @flow */
import {Connection, PublicKey} from '@solana/web3.js';

import {Collection} from '../../../wasm';

export async function refreshCollection(
  connection: Connection,
  collection: PublicKey,
): Collection {
  console.log(`Loading collection ${collection.toString()}`);
  const accountInfo = await connection.getAccountInfo(collection);
  Collection.fromData(accountInfo.data);
}
