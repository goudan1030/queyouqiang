App({
  onLaunch() {
    wx.setInnerAudioOption({ mixWithOther: true, obeyMuteSwitch: false });
  }
});
