mod collection;
mod poll;
mod tally;

use crate::result::{ProgramError, ProgramResult};
use crate::util::{
    expect_data_type, expect_key, expect_min_size, expect_n_accounts, expect_owned_by,
    expect_signed, expect_zeroed, CLOCK_KEY,
};
use core::convert::TryFrom;
use prediction_poll_data::{
    ClockData, CollectionData, CommandData, DataType, InitPollData, PollData, TallyData,
    MIN_COLLECTION_SIZE, MIN_TALLY_SIZE,
};
use solana_sdk_bpf_utils::entrypoint::{SolClusterInfo, SolKeyedAccount};
use solana_sdk_bpf_utils::info;

pub fn process_instruction(
    keyed_accounts: &mut [SolKeyedAccount],
    info: &SolClusterInfo,
    data: &[u8],
) -> ProgramResult<()> {
    let (command, data) = data.split_at(1);
    let command =
        CommandData::try_from(command[0].to_be()).map_err(|_| ProgramError::InvalidCommand)?;
    match command {
        CommandData::InitCollection => init_collection(keyed_accounts, info),
        CommandData::InitPoll => init_poll(keyed_accounts, data, info),
        CommandData::SubmitVote => submit_vote(keyed_accounts, info),
        CommandData::SubmitClaim => submit_claim(keyed_accounts, info),
    }
}

fn init_collection(
    keyed_accounts: &mut [SolKeyedAccount],
    info: &SolClusterInfo,
) -> ProgramResult<()> {
    info!("init collection");
    expect_n_accounts(keyed_accounts, 1)?;

    let (collection_account, _) = keyed_accounts.split_first_mut().unwrap();
    expect_signed(collection_account)?;
    expect_owned_by(collection_account, info.program_id)?;
    expect_zeroed(collection_account.data)?;
    expect_min_size(collection_account.data, MIN_COLLECTION_SIZE)?;

    collection_account.data[0] = DataType::Collection as u8;

    Ok(())
}

fn init_poll(
    keyed_accounts: &mut [SolKeyedAccount],
    init_data: &[u8],
    info: &SolClusterInfo,
) -> ProgramResult<()> {
    info!("init poll");
    expect_n_accounts(keyed_accounts, 6)?;

    let (creator_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_signed(creator_account)?;

    let (poll_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_signed(poll_account)?;
    expect_owned_by(poll_account, info.program_id)?;
    expect_zeroed(poll_account.data)?;

    let (collection_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_owned_by(collection_account, info.program_id)?;
    expect_data_type(collection_account, DataType::Collection)?;

    let (tally_a_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_signed(tally_a_account)?;
    expect_owned_by(tally_a_account, info.program_id)?;
    expect_zeroed(tally_a_account.data)?;
    expect_min_size(tally_a_account.data, MIN_TALLY_SIZE)?;

    let (tally_b_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_signed(tally_b_account)?;
    expect_owned_by(tally_b_account, info.program_id)?;
    expect_zeroed(tally_b_account.data)?;
    expect_min_size(tally_b_account.data, MIN_TALLY_SIZE)?;

    let (clock_account, _) = keyed_accounts.split_first_mut().unwrap();
    expect_key(clock_account, &CLOCK_KEY)?;

    let mut collection = CollectionData::from_bytes(collection_account.data);
    let init_poll = InitPollData::from_bytes(init_data);
    let clock = ClockData::from_bytes(clock_account.data);
    let poll_data = PollData::init(
        init_poll,
        creator_account.key,
        tally_a_account.key,
        tally_b_account.key,
        clock.slot,
    )
    .to_bytes();

    collection::add_poll(&mut collection, poll_account.key)?;
    poll_account.data[0..poll_data.len()].copy_from_slice(&poll_data);
    tally_a_account.data[0] = DataType::Tally as u8;
    tally_b_account.data[0] = DataType::Tally as u8;

    Ok(())
}

fn submit_vote(keyed_accounts: &mut [SolKeyedAccount], info: &SolClusterInfo) -> ProgramResult<()> {
    info!("submit vote");
    expect_n_accounts(keyed_accounts, 5)?;

    let (user_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_signed(user_account)?;
    expect_owned_by(user_account, info.program_id)?;

    let (poll_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_owned_by(poll_account, info.program_id)?;
    expect_data_type(poll_account, DataType::Poll)?;

    let (tally_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_owned_by(tally_account, info.program_id)?;
    expect_data_type(tally_account, DataType::Tally)?;

    let (payout_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    let (clock_account, _) = keyed_accounts.split_first_mut().unwrap();
    expect_key(clock_account, &CLOCK_KEY)?;

    let clock = ClockData::from_bytes(clock_account.data);
    let mut poll = PollData::from_bytes(poll_account.data);
    let mut tally = TallyData::from_bytes(tally_account.data);

    if poll.last_block < clock.slot {
        return Err(ProgramError::PollAlreadyFinished);
    }

    if *user_account.lamports == 0 {
        return Err(ProgramError::WagerHasNoFunds);
    }

    let wager = *user_account.lamports;
    poll::record_wager(&mut poll, tally_account.key, wager)?;
    tally::record_wager(&mut tally, payout_account.key, wager)?;

    *poll_account.lamports += wager;
    *user_account.lamports = 0;

    let poll_data = poll.to_bytes();
    poll_account.data[0..poll_data.len()].copy_from_slice(&poll_data);
    Ok(())
}

fn submit_claim(
    keyed_accounts: &mut [SolKeyedAccount],
    info: &SolClusterInfo,
) -> ProgramResult<()> {
    info!("submit claim");
    // No signer needed
    expect_n_accounts(keyed_accounts, 3)?;

    let (poll_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_owned_by(poll_account, info.program_id)?;
    expect_data_type(poll_account, DataType::Poll)?;

    let (tally_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_owned_by(tally_account, info.program_id)?;
    expect_data_type(tally_account, DataType::Tally)?;

    let (clock_account, keyed_accounts) = keyed_accounts.split_first_mut().unwrap();
    expect_key(clock_account, &CLOCK_KEY)?;

    if *poll_account.lamports <= 1 {
        return Err(ProgramError::PollHasNoFunds);
    }

    let clock = ClockData::from_bytes(clock_account.data);
    let poll = PollData::from_bytes(poll_account.data);
    let tally = TallyData::from_bytes(tally_account.data);

    if poll.last_block > clock.slot {
        return Err(ProgramError::PollNotFinished);
    }

    expect_n_accounts(keyed_accounts, *tally.len as usize)?;

    let pot = *poll_account.lamports - 1;
    *poll_account.lamports = 1;

    let winning_quantity = poll::check_winning_tally(&poll, tally_account.key)?;
    tally::payout(&tally, keyed_accounts, winning_quantity, pot)?;

    Ok(())
}
