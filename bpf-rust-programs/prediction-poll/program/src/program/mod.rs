mod collection;
mod command;

use crate::result::ProgramResult;
use crate::util::expect_n_accounts;
use command::Command;
use core::convert::TryFrom;
use prediction_poll_data::{CollectionData, PollData};
use solana_sdk_bpf_utils::entrypoint::SolKeyedAccount;
use solana_sdk_bpf_utils::info;

pub fn process_instruction(
    keyed_accounts: &mut [SolKeyedAccount],
    data: &[u8],
) -> ProgramResult<()> {
    let (command, data) = data.split_at(1);
    let command = Command::try_from(command[0]).unwrap();
    match command {
        Command::InitCollection => init_collection(keyed_accounts),
        Command::InitPoll => init_poll(keyed_accounts, data),
    }
}

fn init_collection(keyed_accounts: &mut [SolKeyedAccount]) -> ProgramResult<()> {
    info!("init collection");
    expect_n_accounts(keyed_accounts, 1)?;
    let (collection_account, _) = keyed_accounts.split_first_mut().unwrap();

    let mut collection = CollectionData::from_bytes(collection_account.data);
    collection.init();

    Ok(())
}

fn init_poll(keyed_accounts: &mut [SolKeyedAccount], init_data: &[u8]) -> ProgramResult<()> {
    info!("init poll");
    expect_n_accounts(keyed_accounts, 2)?;
    let (collection_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    let (poll_account, _) = keyed_accounts.split_first_mut().unwrap();

    let mut collection = CollectionData::from_bytes(collection_account.data);
    let poll = PollData::from_bytes(init_data);
    let poll_data = poll.to_bytes();

    collection::add_poll(&mut collection, poll_account.key)?;
    poll_account.data[0..poll_data.len()].copy_from_slice(&poll_data);

    Ok(())
}
