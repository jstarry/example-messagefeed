use crate::result::ProgramError;
use core::convert::TryFrom;

#[repr(u8)]
pub enum Command {
    InitCollection,
    InitPoll,
    SubmitVote,
    SubmitClaim,
}

impl TryFrom<u8> for Command {
    type Error = ProgramError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Command::InitCollection),
            1 => Ok(Command::InitPoll),
            2 => Ok(Command::SubmitVote),
            3 => Ok(Command::SubmitClaim),
            _ => Err(ProgramError::InvalidCommand),
        }
    }
}
