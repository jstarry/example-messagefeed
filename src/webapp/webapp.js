import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import IdleTimer from 'react-idle-timer';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import Snackbar from '@material-ui/core/Snackbar';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import {withStyles} from '@material-ui/core/styles';
import {withRouter, HashRouter} from 'react-router-dom';
import {PublicKey} from '@solana/web3.js';

import Api from './api';
import MessageList from './components/message-list';
import PollGrid from './components/poll-grid';
import Toolbar from './components/toolbar';

const MESSAGES_TAB = 0;
const POLLS_TAB = 1;

const styles = () => ({
  root: {
    width: '100%',
  },
});

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      banUserAlreadyBanned: false,
      banUserDialogOpen: false,
      banUserMessage: null,
      loadingMessages: true,
      loadingPolls: true,
      busyLoggingIn: false,
      busyPosting: false,
      idle: true,
      loginMethod: 'none',
      clock: 0,
      messages: [],
      polls: [],
      snackMessage: '',
      transactionSignature: null,
      userAccount: null,
      payerBalance: 0,
      payerKey: null,
      programId: null,
      selectedTab: this.routeToTab(props.location.pathname),
      walletUrl: '',
    };

    this.api = new Api();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.location !== this.props.location) {
      const selectedTab = this.routeToTab(nextProps.location.pathname);
      this.setState({selectedTab});
    }
  }

  routeToTab(route) {
    switch (route) {
      case '/polls':
        return POLLS_TAB;
      default:
        return MESSAGES_TAB;
    }
  }

  tabToRoute(tab) {
    switch (tab) {
      case POLLS_TAB:
        return '/polls';
      default:
        return '/';
    }
  }

  onChangeTab(selectedTab) {
    this.props.history.replace(this.tabToRoute(selectedTab));
  }

  componentDidMount() {
    this.onActive();
  }

  componentWillUnmount() {
    this.onIdle();
  }

  onActive() {
    this.setState({idle: false});

    this.api.subscribeConfig(config => {
      this.setState(config);
    });

    this.api.subscribeBalance((payerBalance, payerKey) => {
      this.setState({payerBalance, payerKey});
    });

    this.api.subscribeMessages(messages => {
      this.setState({
        loadingMessages: false,
        messages,
      });
    });

    this.api.subscribePolls(polls => {
      this.setState({
        loadingPolls: false,
        polls,
      });
    });

    this.api.subscribeClock(clock => {
      this.setState({clock});
    });
  }

  onIdle() {
    this.setState({idle: true});
    this.api.unsubscribe();
  }

  async onLogin() {
    this.setState({busyLoggingIn: true});
    const newState = {busyLoggingIn: false};
    try {
      const userAccount = await this.api.login(this.state.loginMethod);
      Object.assign(newState, {userAccount});
    } catch (err) {
      console.error(err);
    } finally {
      this.setState(newState);
    }
  }

  requestFunds() {
    this.api.requestFunds(res => this.setState(res));
  }

  showTabPage() {
    switch (this.state.selectedTab) {
      case MESSAGES_TAB: {
        return (
          <MessageList
            messages={this.state.messages}
            onBanUser={msg => this.onBanUser(msg)}
            payerBalance={this.state.payerBalance}
            userAccount={this.state.userAccount}
            userAuthenticated={!!this.state.userAccount}
          />
        );
      }
      case POLLS_TAB: {
        return (
          <React.Fragment>
            <PollGrid
              clock={this.state.clock}
              polls={this.state.polls}
              busy={this.busy()}
              payerBalance={this.state.payerBalance}
              payerKey={this.state.payerKey}
              onVote={(...args) => this.vote(...args)}
              onClaim={(...args) => this.claim(...args)}
              onCreate={(...args) => this.createPoll(...args)}
            />
          </React.Fragment>
        );
      }
      default:
        return null;
    }
  }

  busy() {
    const {
      loadingMessages,
      loadingPolls,
      busyPosting,
      busyLoggingIn,
    } = this.state;
    return loadingMessages || loadingPolls || busyPosting || busyLoggingIn;
  }

  render() {
    const {classes} = this.props;

    let banUserDialog;
    if (this.state.banUserMessage !== null) {
      const user = this.state.banUserMessage.name;

      if (this.state.banUserAlreadyBanned) {
        banUserDialog = (
          <Dialog
            open={this.state.banUserDialogOpen}
            onClose={this.onBanUserDialogClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-dialog-title">{`Ban ${user}`}</DialogTitle>
            <DialogContent>
              <DialogContentText id="alert-dialog-description">
                <b>{user}</b> has already been banned
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button
                autoFocus
                onClick={this.onBanUserDialogClose}
                color="primary"
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>
        );
      } else {
        banUserDialog = (
          <Dialog
            open={this.state.banUserDialogOpen}
            onClose={this.onBanUserDialogClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-dialog-title">{`Ban ${user}`}</DialogTitle>
            <DialogContent>
              <DialogContentText id="alert-dialog-description">
                Do you want to prohibit <b>{user}</b> from posting new messages?
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={this.onBanUserDialogConfirm} color="secondary">
                Ban User
              </Button>
              <Button
                autoFocus
                onClick={this.onBanUserDialogClose}
                color="primary"
              >
                Cancel
              </Button>
            </DialogActions>
          </Dialog>
        );
      }
    }

    return (
      <div className={classes.root}>
        <Toolbar
          busy={this.busy()}
          explorerUrl={this.blockExplorerTransactionsByProgramUrl()}
          idle={this.state.idle}
          loginDisabled={this.state.loginMethod === 'none'}
          messageCount={this.state.messages.length}
          onLogin={() => this.onLogin()}
          onPostMessage={msg => this.postMessage(msg)}
          onRequestFunds={() => this.requestFunds()}
          payerBalance={this.state.payerBalance}
          userAuthenticated={!!this.state.userAccount}
          walletDisabled={!this.state.walletUrl}
          showMessageInput={this.state.selectedTab === MESSAGES_TAB}
        />
        <IdleTimer
          element={document}
          onActive={() => this.onActive()}
          onIdle={() => this.onIdle()}
          debounce={250}
          timeout={1000 * 60 * 15}
        />
        <Paper square={true}>
          <Tabs
            value={this.state.selectedTab}
            onChange={(e, selectedTab) => this.onChangeTab(selectedTab)}
            indicatorColor="primary"
            textColor="primary"
            centered
          >
            <Tab label="Messages" />
            <Tab label="Polls" />
          </Tabs>
        </Paper>
        {this.showTabPage()}
        <Snackbar
          open={this.state.snackMessage !== ''}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          autoHideDuration={6000}
          onClose={this.onSnackClose}
          ContentProps={{
            'aria-describedby': 'message-id',
          }}
          message={<span id="message-id">{this.state.snackMessage}</span>}
          action={
            this.state.transactionSignature ? (
              <Button
                color="secondary"
                size="small"
                href={this.blockExplorerLatestTransactionUrl()}
              >
                Transaction Details
              </Button>
            ) : (
              ''
            )
          }
        />
        {banUserDialog}
      </div>
    );
  }

  async postMessage(newMessage: string, userToBan = null) {
    if (newMessage.length === 0) {
      return false;
    }

    if (this.state.busyPosting) {
      this.setState({
        snackMessage: 'Unable to post message, please retry when not busy',
        transactionSignature: null,
      });
      return false;
    }

    this.setState({busyPosting: true});

    const {snackMessage, transactionSignature} = await this.api.postMessage(
      newMessage,
      userToBan,
    );

    this.setState({
      busyPosting: false,
      snackMessage,
      transactionSignature,
    });

    return true;
  }

  async vote(pollKey, wager, tally) {
    if (this.state.busyPosting) {
      this.setState({
        snackMessage: 'Unable to vote, please retry when not busy',
        transactionSignature: null,
      });
      return false;
    }

    const tallyKey = new PublicKey(tally);
    console.log(`vote for tally: ${tallyKey.toString()}`);
    this.setState({busyPosting: true});
    const {snackMessage, transactionSignature} = await this.api.vote(
      pollKey,
      wager,
      tally,
    );

    this.setState({
      busyPosting: false,
      snackMessage,
      transactionSignature,
    });

    return true;
  }

  async claim(poll, pollKey) {
    if (this.state.busyPosting) {
      this.setState({
        snackMessage: 'Unable to submit claim, please retry when not busy',
        transactionSignature: null,
      });
      return false;
    }

    this.setState({busyPosting: true});
    const {snackMessage, transactionSignature} = await this.api.claim(
      poll,
      pollKey,
    );

    this.setState({
      busyPosting: false,
      snackMessage,
      transactionSignature,
    });

    return true;
  }

  async createPoll(...args) {
    if (this.state.busyPosting) {
      this.setState({
        snackMessage: 'Unable to create poll, please retry when not busy',
        transactionSignature: null,
      });
      return false;
    }

    this.setState({busyPosting: true});

    const {snackMessage, transactionSignature} = await this.api.createPoll(
      ...args,
    );

    this.setState({
      busyPosting: false,
      snackMessage,
      transactionSignature,
    });

    return true;
  }

  onSnackClose = () => {
    this.setState({
      snackMessage: '',
      transactionSignature: null,
    });
  };

  onBanUser = async message => {
    try {
      const banUserAlreadyBanned = await this.api.isUserBanned(message.from);
      this.setState({
        banUserDialogOpen: true,
        banUserAlreadyBanned,
        banUserMessage: message,
      });
    } catch (err) {
      console.error(err);
    }
  };

  onBanUserDialogClose = () => {
    this.setState({
      banUserDialogOpen: false,
      banUserMessage: null,
    });
  };

  onBanUserDialogConfirm = () => {
    this.onBanUserDialogClose();
    this.postMessage(
      `${this.state.banUserMessage.name} has been banned`,
      this.state.banUserMessage.from,
    );
  };

  blockExplorerTransactionsByProgramUrl = (): string | null => {
    if (!this.state.explorerUrl) return;
    if (!this.state.programId) return;
    return `${this.state.explorerUrl}/txns-by-prgid/${this.state.programId}`;
  };

  blockExplorerLatestTransactionUrl = () => {
    if (!this.state.explorerUrl) return;
    if (!this.state.programId) return;
    if (this.state.transactionSignature === null) return;
    return `${this.state.explorerUrl}/txns-by-prgid/${this.state.programId}`;
  };
}
App.propTypes = {
  classes: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
};

const StyledApp = withStyles(styles)(withRouter(App));
ReactDOM.render(
  <HashRouter>
    <StyledApp />
  </HashRouter>,
  document.getElementById('app'),
);
module.hot.accept();
