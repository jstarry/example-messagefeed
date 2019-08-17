/**
 * The commands (encoded as Transaction Instructions) that are accepted by the
 * TicTacToe Game and Dashboard program
 *
 * @flow
 */

import * as BufferLayout from 'buffer-layout';
import {PublicKey} from '@solana/web3.js';

import {InitPoll} from '../../../wasm';

const COMMAND_LENGTH = 8;

const Command = {
  InitCollection: 0,
  InitPoll: 1,
  SubmitVote: 2,
  SubmitClaim: 3,
};

function zeroPad(command: Buffer): Buffer {
  if (command.length > COMMAND_LENGTH) {
    throw new Error(
      `command buffer too large: ${command.length} > ${COMMAND_LENGTH}`,
    );
  }
  const buffer = Buffer.alloc(COMMAND_LENGTH);
  command.copy(buffer);
  return buffer;
}

function commandWithNoArgs(command: number): Buffer {
  const layout = BufferLayout.struct([BufferLayout.u32('command')]);
  const buffer = Buffer.alloc(layout.span);
  layout.encode({command}, buffer);
  return zeroPad(buffer);
}

export function initCollection(): Buffer {
  return commandWithNoArgs(Command.InitCollection);
}

export function submitVote(): Buffer {
  return commandWithNoArgs(Command.SubmitVote);
}

export function submitClaim(): Buffer {
  return commandWithNoArgs(Command.SubmitClaim);
}

export function initPoll(init: InitPoll): Buffer {
  let init_data = init.toBytes();
  let instruction_data = new Uint8Array(1 + init_data.length);
  instruction_data.set([Command.InitPoll]);
  instruction_data.set(init_data, 1);
  return Buffer.from(instruction_data);
}

/**
 * Public key that identifies the Clock Sysvar Account Public Key
 */
export function getSysvarClockPublicKey(): PublicKey {
  return new PublicKey('SysvarC1ock11111111111111111111111111111111');
}
